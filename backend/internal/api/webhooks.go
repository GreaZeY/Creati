package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"time"

	"creati.in/creati/backend/internal/events"
	"creati.in/creati/backend/internal/middleware"
	"creati.in/creati/backend/internal/services"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

/**
 * Webhook handlers for platform upload detection
 * Following Single Responsibility: ONLY handles webhook ingestion
 * Processing happens asynchronously in workers
 */

type WebhookHandler struct {
	db          *sql.DB
	eventStore  *events.Store
	WhatsAppSvc *services.WhatsAppService
	QueueSvc    *services.QueueService
}

func NewWebhookHandler(db *sql.DB, whatsappSvc *services.WhatsAppService, queueSvc *services.QueueService) *WebhookHandler {
	return &WebhookHandler{
		db:          db,
		eventStore:  events.NewStore(db),
		WhatsAppSvc: whatsappSvc,
		QueueSvc:    queueSvc,
	}
}

// ====== YOUTUBE WEBSUB HANDLERS ======

// YouTubeWebhookVerification handles YouTube WebSub subscription verification (GET)
func (h *WebhookHandler) YouTubeWebhookVerification(c *fiber.Ctx) error {
	challenge := c.Query("hub.challenge")
	mode := c.Query("hub.mode")
	topic := c.Query("hub.topic")

	log.Printf("YouTube WebSub verification: mode=%s, topic=%s", mode, topic)

	if challenge == "" {
		return c.Status(fiber.StatusBadRequest).SendString("missing challenge")
	}

	// Respond with the challenge to confirm subscription
	return c.SendString(challenge)
}

// YouTubeWebhookNotification handles YouTube WebSub content notifications (POST)
func (h *WebhookHandler) YouTubeWebhookNotification(c *fiber.Ctx) error {
	// Read raw body
	body, err := io.ReadAll(c.Request().BodyStream())
	if err != nil {
		log.Printf("Failed to read YouTube webhook body: %v", err)
		return c.SendStatus(fiber.StatusBadRequest)
	}

	// Parse with YouTube adapter
	adapter := &events.YouTubeAdapter{}
	normalizedEvent, err := adapter.ParsePayload(body)
	if err != nil {
		log.Printf("Failed to parse YouTube payload: %v", err)
		// Still return 200 to prevent retries for malformed payloads
		return c.SendStatus(fiber.StatusOK)
	}

	// Look up account_id from channel_id
	channelID, ok := normalizedEvent.Payload["channel_id"].(string)
	if !ok || channelID == "" {
		log.Printf("Missing channel_id in YouTube payload")
		return c.SendStatus(fiber.StatusOK)
	}

	var accountID int
	err = h.db.QueryRow(`
		SELECT id FROM platform_accounts 
		WHERE platform = 'youtube' AND external_account_id = $1
	`, channelID).Scan(&accountID)

	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("No account found for YouTube channel: %s", channelID)
		} else {
			log.Printf("Database error looking up channel: %v", err)
		}
		// Return 200 to prevent retries (not our user's video)
		return c.SendStatus(fiber.StatusOK)
	}

	// Set account ID and generate dedup key
	normalizedEvent.AccountID = accountID
	normalizedEvent.DedupKey = adapter.GenerateDedupKey(normalizedEvent)
	normalizedEvent.ID = uuid.New()

	// Store event (idempotent)
	err = h.eventStore.CreateEvent(c.Context(), normalizedEvent)
	if err == events.ErrDuplicateEvent {
		log.Printf("Duplicate YouTube event ignored: video_id=%s", normalizedEvent.ExternalID)
		return c.SendStatus(fiber.StatusOK)
	}
	if err != nil {
		log.Printf("Failed to store YouTube event: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "storage error",
		})
	}

	log.Printf("YouTube event stored: video_id=%s, account_id=%d", normalizedEvent.ExternalID, accountID)
	return c.SendStatus(fiber.StatusOK)
}

// ====== EVENT MANAGEMENT ENDPOINTS (Dev/Admin) ======

// ListEvents returns recent platform events (protected endpoint)
func (h *WebhookHandler) ListEvents(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	// Parse query params
	platform := c.Query("platform")
	limit := c.QueryInt("limit", 50)
	offset := c.QueryInt("offset", 0)

	// Get user's account IDs for filtering
	rows, err := h.db.Query(`
		SELECT id FROM platform_accounts WHERE user_id = $1
	`, userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "database error",
		})
	}
	defer rows.Close()

	var accountIDs []int
	for rows.Next() {
		var id int
		rows.Scan(&id)
		accountIDs = append(accountIDs, id)
	}

	// Fetch events (simplified - in production would filter by account IDs array)
	// For now, fetch all and filter in Go
	var platformPtr *string
	if platform != "" {
		platformPtr = &platform
	}

	allEvents, err := h.eventStore.ListEvents(c.Context(), nil, platformPtr, limit, offset)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to fetch events",
		})
	}

	// Filter to user's accounts
	var userEvents []*events.NormalizedEvent
	accountMap := make(map[int]bool)
	for _, id := range accountIDs {
		accountMap[id] = true
	}

	for _, event := range allEvents {
		if accountMap[event.AccountID] {
			userEvents = append(userEvents, event)
		}
	}

	return c.JSON(fiber.Map{
		"data": userEvents,
	})
}

// GetEvent returns a single event by ID (protected endpoint)
func (h *WebhookHandler) GetEvent(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	eventIDStr := c.Params("id")

	eventID, err := uuid.Parse(eventIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid event ID",
		})
	}

	event, err := h.eventStore.GetEventByID(c.Context(), eventID)
	if err == events.ErrEventNotFound {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "event not found",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "database error",
		})
	}

	// Verify user owns this event's account
	var ownerID int
	err = h.db.QueryRow(`
		SELECT user_id FROM platform_accounts WHERE id = $1
	`, event.AccountID).Scan(&ownerID)

	if err != nil || ownerID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "access denied",
		})
	}

	return c.JSON(fiber.Map{
		"data": event,
	})
}

// ReplayEvent resets an event to pending status for reprocessing (dev only)
func (h *WebhookHandler) ReplayEvent(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	eventIDStr := c.Params("id")

	eventID, err := uuid.Parse(eventIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid event ID",
		})
	}

	// Verify ownership first
	event, err := h.eventStore.GetEventByID(c.Context(), eventID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "event not found",
		})
	}

	var ownerID int
	err = h.db.QueryRow(`
		SELECT user_id FROM platform_accounts WHERE id = $1
	`, event.AccountID).Scan(&ownerID)

	if err != nil || ownerID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "access denied",
		})
	}

	// Reset to pending
	err = h.eventStore.ResetEventForRetry(c.Context(), eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to replay event",
		})
	}

	return c.JSON(fiber.Map{
		"message": "event queued for replay",
	})
}

// SimulateEvent creates a fake event for testing (dev only - should be gated by env var)
func (h *WebhookHandler) SimulateEvent(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	type SimulateRequest struct {
		Platform   string                 `json:"platform"`
		EventType  string                 `json:"event_type"`
		ExternalID string                 `json:"external_id"`
		AccountID  int                    `json:"account_id"`
		Payload    map[string]interface{} `json:"payload"`
	}

	var req SimulateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request",
		})
	}

	// Verify user owns the account
	var ownerID int
	err := h.db.QueryRow(`
		SELECT user_id FROM platform_accounts WHERE id = $1
	`, req.AccountID).Scan(&ownerID)

	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "account not found",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "database error",
		})
	}
	if ownerID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "access denied",
		})
	}

	// Create simulated event
	event := events.NewNormalizedEvent(
		req.Platform,
		req.EventType,
		req.ExternalID,
		req.AccountID,
		req.Payload,
	)

	err = h.eventStore.CreateEvent(c.Context(), event)
	if err == events.ErrDuplicateEvent {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "duplicate event",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("failed to create event: %v", err),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"data": event,
	})
}

// ====== WHATSAPP HANDLERS ======

// WhatsAppWebhookVerification handles Meta's webhook verification challenge (GET)
func (h *WebhookHandler) WhatsAppWebhookVerification(c *fiber.Ctx) error {
	mode := c.Query("hub.mode")
	token := c.Query("hub.verify_token")
	challenge := c.Query("hub.challenge")

	if mode == "subscribe" && token == os.Getenv("WHATSAPP_VERIFY_TOKEN") {
		return c.SendString(challenge)
	}

	return c.SendStatus(fiber.StatusForbidden)
}

// WhatsAppWebhook handles incoming WhatsApp messages and interactive replies (POST)
func (h *WebhookHandler) WhatsAppWebhook(c *fiber.Ctx) error {
	var body struct {
		Entry []struct {
			Changes []struct {
				Value struct {
					Messages []struct {
						Type        string `json:"type"`
						Interactive struct {
							ButtonReply struct {
								ID string `json:"id"`
							} `json:"button_reply"`
						} `json:"interactive"`
					} `json:"messages"`
				} `json:"value"`
			} `json:"changes"`
		} `json:"entry"`
	}

	if err := c.BodyParser(&body); err != nil {
		return c.SendStatus(fiber.StatusOK)
	}

	for _, entry := range body.Entry {
		for _, change := range entry.Changes {
			for _, msg := range change.Value.Messages {
				if msg.Type == "interactive" && msg.Interactive.ButtonReply.ID != "" {
					h.handleRetryReply(c.Context(), msg.Interactive.ButtonReply.ID)
				}
			}
		}
	}

	return c.SendStatus(fiber.StatusOK)
}

func (h *WebhookHandler) handleRetryReply(ctx context.Context, token string) {
	if h.WhatsAppSvc == nil || h.QueueSvc == nil {
		return
	}

	executionID, valid := h.WhatsAppSvc.VerifyRetryToken(token)
	if !valid {
		log.Printf("Invalid WhatsApp retry token: %s", token)
		return
	}

	// Fetch execution details for re-queueing
	var contentID, targetPlatform string
	var accountID int
	err := h.db.QueryRowContext(ctx, `
		SELECT content_id, target_platform, target_account_id 
		FROM automation_executions 
		WHERE id = $1
	`, executionID).Scan(&contentID, &targetPlatform, &accountID)

	if err != nil {
		log.Printf("Failed to fetch execution for retry: %v", err)
		return
	}

	// Update status to re-queued
	_, _ = h.db.ExecContext(ctx, "UPDATE automation_executions SET status = 'queued', error = NULL WHERE id = $1", executionID)

	// Re-enqueue
	payload, _ := json.Marshal(map[string]interface{}{
		"content_id":      contentID,
		"target_platform": targetPlatform,
		"account_id":      accountID,
		"execution_id":    executionID,
		"enqueued_at":     time.Now(),
	})

	_ = h.QueueSvc.Client.LPush(ctx, services.QueueUpload, payload).Err()
	log.Printf("WhatsApp Remote Retry Triggered: %s", executionID)
}
