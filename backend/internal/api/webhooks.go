package api

import (
	"database/sql"
	"fmt"
	"io"
	"log"

	"example.com/creati/backend/internal/events"
	"example.com/creati/backend/internal/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

/**
 * Webhook handlers for platform upload detection
 * Following Single Responsibility: ONLY handles webhook ingestion
 * Processing happens asynchronously in workers
 */

type WebhookHandler struct {
	db         *sql.DB
	eventStore *events.Store
}

func NewWebhookHandler(db *sql.DB) *WebhookHandler {
	return &WebhookHandler{
		db:         db,
		eventStore: events.NewStore(db),
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
