package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"os"

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

type CreateOrderRequest struct {
	PlanID       string `json:"planId"`       // 'creator' or 'pro'
	BillingCycle string `json:"billingCycle"` // 'monthly' or 'yearly'
}

type VerifyPaymentRequest struct {
	RazorpayOrderID   string `json:"razorpay_order_id"`
	RazorpayPaymentID string `json:"razorpay_payment_id"`
	RazorpaySignature string `json:"razorpay_signature"`
	PlanID            string `json:"planId"`
	BillingCycle      string `json:"billingCycle"`
}

// Pricing configuration
var pricing = map[string]map[string]int{
	features.PlanCreator: {
		"monthly": 49900,  // in paise (₹499)
		"yearly":  499900, // in paise (₹4999)
	},
	features.PlanPro: {
		"monthly": 129900,  // in paise (₹1299)
		"yearly":  1199900, // in paise (₹11999)
	},
}

// CreateOrder initiates a Razorpay order
func (h *PaymentHandler) CreateOrder(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	var req CreateOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request")
	}

	amount, ok := pricing[req.PlanID][req.BillingCycle]
	if !ok {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid plan or billing cycle")
	}

	// Create Razorpay Order
	data := map[string]interface{}{
		"amount":   amount,
		"currency": "INR",
		"receipt":  fmt.Sprintf("rcpt_%d_%s", userID, req.PlanID),
		"notes": map[string]interface{}{
			"user_id":       userID,
			"plan":          req.PlanID,
			"billing_cycle": req.BillingCycle,
		},
	}

	body, err := h.client.Order.Create(data, nil)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to create razorpay order")
	}

	orderID, _ := body["id"].(string)

	// Log intention to pay
	_, err = h.db.Exec(`
		INSERT INTO payments (user_id, razorpay_order_id, amount, currency, status)
		VALUES ($1, $2, $3, $4, 'created')
	`, userID, orderID, float64(amount)/100.0, "INR")

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error")
	}

	return utils.SuccessResponse(c, fiber.Map{
		"orderId":  orderID,
		"amount":   amount,
		"currency": "INR",
		"key":      os.Getenv("RAZORPAY_KEY_ID"),
	}, "order created")
}

// VerifyPayment handles the success callback/verification from frontend
func (h *PaymentHandler) VerifyPayment(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	var req VerifyPaymentRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request")
	}

	// Verify Signature locally
	secret := os.Getenv("RAZORPAY_KEY_SECRET")
	data := req.RazorpayOrderID + "|" + req.RazorpayPaymentID
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

	// 1. Update Payment Status
	_, err = tx.Exec(`
		UPDATE payments 
		SET razorpay_payment_id = $1, status = 'captured' 
		WHERE razorpay_order_id = $2
	`, req.RazorpayPaymentID, req.RazorpayOrderID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to update payment")
	}

	// 2. Update/Upsert Subscription
	// Calculate period end
	interval := "1 month"
	if req.BillingCycle == "yearly" {
		interval = "1 year"
	}

	// Check if exists
	var subID int
	err = tx.QueryRow("SELECT id FROM subscriptions WHERE user_id = $1", userID).Scan(&subID)

	if err == sql.ErrNoRows {
		// Create new
		_, err = tx.Exec(`
			INSERT INTO subscriptions (user_id, plan, billing_cycle, status, current_period_end)
			VALUES ($1, $2, $3, 'active', NOW() + $4::INTERVAL)
		`, userID, req.PlanID, req.BillingCycle, interval)
	} else {
		// Update existing
		_, err = tx.Exec(`
			UPDATE subscriptions 
			SET plan = $1, billing_cycle = $2, status = 'active', 
			    current_period_start = NOW(),
			    current_period_end = NOW() + $3::INTERVAL,
				updated_at = NOW()
			WHERE user_id = $4
		`, req.PlanID, req.BillingCycle, interval, userID)
	}

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to update subscription")
	}

	if err := tx.Commit(); err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "transaction failed")
	}

	return utils.SuccessResponse(c, nil, "payment verified and subscription updated")
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

	// Populate features based on plan
	// We need to convert the map[Capability]interface{} to string keys for JSON
	entitlements := make(map[string]interface{})

	// Magic Sync
	entitlements["canUseMagicSync"] = features.HasFeature(sub.Plan, features.CanUseMagicSync)
	entitlements["canUseAdvancedAnalytics"] = features.HasFeature(sub.Plan, features.CanUseAdvancedAnalytics)
	entitlements["maxUploads"] = features.GetLimit(sub.Plan, features.MaxUploadsPerMonth)
	entitlements["maxConnectedAccounts"] = features.GetLimit(sub.Plan, features.MaxConnectedAccounts)

	sub.Features = entitlements

	return utils.SuccessResponse(c, sub, "")
}

func hmacSha256(data string, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil))
}
