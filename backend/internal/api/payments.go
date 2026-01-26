package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"os"
	"strings"

	"example.com/creati/backend/internal/features"
	"example.com/creati/backend/internal/middleware"
	"example.com/creati/backend/internal/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/razorpay/razorpay-go"
)

type PaymentHandler struct {
	db     *sql.DB
	client *razorpay.Client
}

func NewPaymentHandler(db *sql.DB) *PaymentHandler {
	keyID := os.Getenv("RAZORPAY_KEY_ID")
	keySecret := os.Getenv("RAZORPAY_KEY_SECRET")
	client := razorpay.NewClient(keyID, keySecret)
	return &PaymentHandler{db: db, client: client}
}

type CreateSubscriptionRequest struct {
	PlanID       string `json:"planId"`       // 'creator' or 'pro'
	BillingCycle string `json:"billingCycle"` // 'monthly' or 'yearly'
}

type UpdateSubscriptionRequest struct {
	TargetPlanID string `json:"targetPlanId"`
	BillingCycle string `json:"billingCycle"`
}

type VerifySubscriptionRequest struct {
	RazorpaySubscriptionID string `json:"razorpay_subscription_id"`
	RazorpayPaymentID      string `json:"razorpay_payment_id"`
	RazorpaySignature      string `json:"razorpay_signature"`
	PlanID                 string `json:"planId"`
	BillingCycle           string `json:"billingCycle"`
}

// Pricing configuration - keeping for reference, but actual pricing is now controlled by Razorpay Plan IDs
var pricing = map[string]map[string]int{
	features.PlanCreator: {
		"monthly": 49900,
		"yearly":  499900,
	},
	features.PlanPro: {
		"monthly": 129900,
		"yearly":  1199900,
	},
}

func getRazorpayPlanID(plan string, cycle string) string {
	// Normalize key to uppercase
	// e.g. RAZORPAY_PLAN_CREATOR_MONTHLY
	p := "CREATOR"
	if plan == features.PlanPro {
		p = "PRO"
	}
	c := "MONTHLY"
	if cycle == "yearly" {
		c = "YEARLY"
	}
	envKey := fmt.Sprintf("RAZORPAY_PLAN_%s_%s", p, c)
	return os.Getenv(envKey)
}

// CreateSubscription initiates a Razorpay subscription
func (h *PaymentHandler) CreateSubscription(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	var req CreateSubscriptionRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request")
	}

	planID := getRazorpayPlanID(req.PlanID, req.BillingCycle)
	if planID == "" {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "plan configuration missing")
	}

	// Create Razorpay Subscription
	// We set total_count to 120 (10 years) essentially "forever" until cancelled
	data := map[string]interface{}{
		"plan_id":     planID,
		"total_count": 120,
		"quantity":    1,
		"notes": map[string]interface{}{
			"user_id":       userID,
			"plan":          req.PlanID,
			"billing_cycle": req.BillingCycle,
		},
	}

	body, err := h.client.Subscription.Create(data, nil)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to create razorpay subscription")
	}

	subID, _ := body["id"].(string)

	return utils.SuccessResponse(c, fiber.Map{
		"subscriptionId": subID,
		"key":            os.Getenv("RAZORPAY_KEY_ID"),
	}, "subscription created")
}

// VerifySubscription handles the success callback/verification from frontend
func (h *PaymentHandler) VerifySubscription(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	var req VerifySubscriptionRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request")
	}

	// Verify Signature locally
	// For subscriptions: payment_id + "|" + subscription_id
	secret := os.Getenv("RAZORPAY_KEY_SECRET")
	data := req.RazorpayPaymentID + "|" + req.RazorpaySubscriptionID
	expectedSignature := hmacSha256(data, secret)

	if expectedSignature != req.RazorpaySignature {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid signature")
	}

	// Start Transaction
	tx, err := h.db.Begin()
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error")
	}
	defer tx.Rollback()

	// 1. Calculate period end
	interval := "1 month"
	if req.BillingCycle == "yearly" {
		interval = "1 year"
	}

	// 2. Insert/Update Subscription
	// We use UPSERT equivalent logic
	var subID int
	err = tx.QueryRow("SELECT id FROM subscriptions WHERE user_id = $1", userID).Scan(&subID)

	if err == sql.ErrNoRows {
		// Create new
		_, err = tx.Exec(`
			INSERT INTO subscriptions (
				user_id, plan, billing_cycle, status, 
				razorpay_subscription_id, 
				current_period_start, current_period_end
			)
			VALUES ($1, $2, $3, 'active', $4, NOW(), NOW() + $5::INTERVAL)
		`, userID, req.PlanID, req.BillingCycle, req.RazorpaySubscriptionID, interval)
	} else {
		// Update existing
		_, err = tx.Exec(`
			UPDATE subscriptions 
			SET plan = $1, billing_cycle = $2, status = 'active', 
				razorpay_subscription_id = $3,
			    current_period_start = NOW(),
			    current_period_end = NOW() + $4::INTERVAL,
				updated_at = NOW()
			WHERE user_id = $5
		`, req.PlanID, req.BillingCycle, req.RazorpaySubscriptionID, interval, userID)
	}

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to update subscription")
	}

	// 3. Log Payment (Optional but good for history)
	_, err = tx.Exec(`
		INSERT INTO payments (user_id, razorpay_order_id, razorpay_payment_id, amount, currency, status)
		VALUES ($1, $2, $3, 0, 'INR', 'captured')
	`, userID, req.RazorpaySubscriptionID, req.RazorpayPaymentID)
	// Note: amount 0 here because we rely on webhooks for actual charge details,
	// or we could lookup plan price. For now, just logging the ID is sufficient proof.

	if err := tx.Commit(); err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "transaction failed")
	}

	return utils.SuccessResponse(c, nil, "subscription verified and updated")
}

// UpdateSubscription handles upgrades/downgrades and resuming cancelled subscriptions
func (h *PaymentHandler) UpdateSubscription(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	var req UpdateSubscriptionRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request")
	}

	var currentSubID string
	var currentPlan string
	var currentStatus string
	// Check for both active and cancelled subscriptions
	err := h.db.QueryRow(`
		SELECT razorpay_subscription_id, plan, status 
		FROM subscriptions 
		WHERE user_id = $1 AND (status = 'active' OR status = 'cancelled')
	`, userID).Scan(&currentSubID, &currentPlan, &currentStatus)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "no active or cancelled subscription found to update")
	}

	newPlanID := getRazorpayPlanID(req.TargetPlanID, req.BillingCycle)
	if newPlanID == "" {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "plan configuration missing")
	}

	// Case 1: Resuming a cancelled subscription to the same plan
	if currentStatus == "cancelled" && currentPlan == req.TargetPlanID {
		// Since Razorpay subscription is still active (cancel_at_cycle_end doesn't actually cancel it),
		// we just need to update our local DB status back to active
		// The subscription will auto-renew normally on Razorpay's side

		_, err = h.db.Exec(`
			UPDATE subscriptions 
			SET status = 'active', updated_at = NOW()
			WHERE user_id = $1
		`, userID)

		if err != nil {
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to update subscription status")
		}

		return utils.SuccessResponse(c, fiber.Map{
			"message": "auto-renewal resumed successfully",
		}, "subscription resumed")
	}

	// Case 2: Plan change (upgrade/downgrade) - works for both active and cancelled
	// Call Razorpay Subscription Update with new plan
	// schedule_change_at = "now" handles proration automatically
	data := map[string]interface{}{
		"plan_id":            newPlanID,
		"schedule_change_at": "now",
		"quantity":           1,
	}

	body, err := h.client.Subscription.Update(currentSubID, data, nil)
	if err != nil {
		// Log the actual error from Razorpay
		fmt.Printf("Razorpay subscription update error: %v\n", err)

		// Check if it's a UPI payment method limitation
		errStr := err.Error()
		if strings.Contains(errStr, "upi") || strings.Contains(errStr, "UPI") {
			return utils.ErrorResponse(c, fiber.StatusBadRequest, "Plan changes aren't supported for UPI subscriptions. Please cancel your current plan and subscribe to the new plan.")
		}

		return utils.ErrorResponse(c, fiber.StatusInternalServerError, fmt.Sprintf("failed to update razorpay subscription: %v", err))
	}

	// Update local DB
	_, err = h.db.Exec(`
		UPDATE subscriptions 
		SET plan = $1, billing_cycle = $2, status = 'active', updated_at = NOW()
		WHERE user_id = $3
	`, req.TargetPlanID, req.BillingCycle, userID)

	if err != nil {
		// Log error but don't fail request since RP update succeeded
		fmt.Printf("Error updating local sub for user %d: %v\n", userID, err)
	}

	return utils.SuccessResponse(c, body, "subscription updated")
}

// CancelSubscription cancels the user's active subscription at the end of billing period
func (h *PaymentHandler) CancelSubscription(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var currentSubID string
	var currentPlan string
	err := h.db.QueryRow(`
		SELECT razorpay_subscription_id, plan 
		FROM subscriptions 
		WHERE user_id = $1 AND status = 'active'
	`, userID).Scan(&currentSubID, &currentPlan)

	if err == sql.ErrNoRows {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "no active subscription found")
	}
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error")
	}

	// Don't allow cancelling free plan
	if currentPlan == features.PlanFree {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "cannot cancel free plan")
	}

	// Cancel on Razorpay - at end of billing cycle
	data := map[string]interface{}{
		"cancel_at_cycle_end": true, // Cancel at end of period
	}

	_, err = h.client.Subscription.Cancel(currentSubID, data, nil)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to cancel subscription with razorpay")
	}

	// Update local DB - mark as cancelled but keep plan active until period ends
	_, err = h.db.Exec(`
		UPDATE subscriptions 
		SET status = 'cancelled', 
		    updated_at = NOW()
		WHERE user_id = $1
	`, userID)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to update subscription status")
	}

	return utils.SuccessResponse(c, fiber.Map{
		"message":           "subscription will be cancelled at end of billing period",
		"access_until":      "current_period_end",
		"auto_renew_status": "disabled",
	}, "subscription scheduled for cancellation")
}

// HandleWebhook processes Razorpay webhooks
func (h *PaymentHandler) HandleWebhook(c *fiber.Ctx) error {
	secret := os.Getenv("RAZORPAY_WEBHOOK_SECRET")
	signature := c.Get("X-Razorpay-Signature")
	body := c.Body()

	// Verify signature
	if !utils.VerifyWebhookSignature(body, signature, secret) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid signature"})
	}

	// Parse JSON
	var payload map[string]interface{}
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid json"})
	}

	event, _ := payload["event"].(string)
	payloadData := payload["payload"].(map[string]interface{})

	// Handle events
	switch event {
	case "subscription.charged":
		h.handleSubscriptionCharged(payloadData)
	case "subscription.halted", "subscription.cancelled":
		h.handleSubscriptionStatusChange(payloadData, event)
	}

	return c.SendStatus(fiber.StatusOK)
}

func (h *PaymentHandler) handleSubscriptionCharged(data map[string]interface{}) {
	subData := data["subscription"].(map[string]interface{})["entity"].(map[string]interface{})
	subID := subData["id"].(string)
	// endAt := subData["current_end"].(float64) // Unix timestamp

	// Update subscription status and validity
	// Ideally convert unix timestamp to time.Time
	// For simplicity in this snippet, extending by interval logic or just trusting RP webhook flow
	// We'll just set status active and update timestamp from DB side or parse properly

	h.db.Exec(`
		UPDATE subscriptions 
		SET status = 'active', current_period_end = to_timestamp($2), updated_at = NOW()
		WHERE razorpay_subscription_id = $1
	`, subID, subData["current_end"])
}

func (h *PaymentHandler) handleSubscriptionStatusChange(data map[string]interface{}, event string) {
	subData := data["subscription"].(map[string]interface{})["entity"].(map[string]interface{})
	subID := subData["id"].(string)
	status := "active"
	if event == "subscription.halted" {
		status = "halted"
	} else if event == "subscription.cancelled" {
		status = "cancelled"
	}

	h.db.Exec(`UPDATE subscriptions SET status = $1 WHERE razorpay_subscription_id = $2`, status, subID)
}

// GetSubscription returns the current user's subscription and entitlements
func (h *PaymentHandler) GetSubscription(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	type SubscriptionResponse struct {
		Plan             string                 `json:"plan"`
		BillingCycle     string                 `json:"billingCycle"`
		Status           string                 `json:"status"`
		CurrentPeriodEnd string                 `json:"currentPeriodEnd"`
		Features         map[string]interface{} `json:"features"`
	}

	var sub SubscriptionResponse
	var currentPeriodEnd sql.NullString

	err := h.db.QueryRow(`
		SELECT plan, billing_cycle, status, current_period_end
		FROM subscriptions
		WHERE user_id = $1
	`, userID).Scan(&sub.Plan, &sub.BillingCycle, &sub.Status, &currentPeriodEnd)

	if err == sql.ErrNoRows {
		// Fallback to free if no record found (shouldn't happen with new auth logic, but good for safety)
		sub = SubscriptionResponse{
			Plan:         features.PlanFree,
			BillingCycle: "monthly",
			Status:       "active",
		}
	} else if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error")
	}

	if currentPeriodEnd.Valid {
		sub.CurrentPeriodEnd = currentPeriodEnd.String
	}

	// If subscription is cancelled but period hasn't ended, treat as active for entitlements
	// This allows users to keep their benefits until the billing period ends
	effectiveStatus := sub.Status
	if sub.Status == "cancelled" && currentPeriodEnd.Valid {
		// Check if period has ended
		// For now, we'll let the frontend/entitlements check current_period_end
		// Status stays 'cancelled' but they still get features
	}

	// Populate features based on plan (even if cancelled, until period ends)
	// Using the actual constant values (snake_case) as keys to match frontend expectations
	entitlements := make(map[string]interface{})

	// Convert Capability constants to string keys for JSON
	entitlements[string(features.CanUseMagicSync)] = features.HasFeature(sub.Plan, features.CanUseMagicSync)
	entitlements[string(features.CanUseAdvancedAnalytics)] = features.HasFeature(sub.Plan, features.CanUseAdvancedAnalytics)
	entitlements[string(features.MaxUploadsPerMonth)] = features.GetLimit(sub.Plan, features.MaxUploadsPerMonth)
	entitlements[string(features.MaxConnectedAccounts)] = features.GetLimit(sub.Plan, features.MaxConnectedAccounts)

	sub.Features = entitlements
	// Add effective status for frontend
	sub.Status = effectiveStatus

	return utils.SuccessResponse(c, sub, "")
}

func hmacSha256(data string, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil))
}
