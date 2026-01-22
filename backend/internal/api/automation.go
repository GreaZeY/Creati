package api

import (
	"database/sql"
	"encoding/json"
	"log"

	"example.com/creati/backend/internal/middleware"
	"example.com/creati/backend/internal/services"
	"example.com/creati/backend/internal/utils"

	"github.com/gofiber/fiber/v2"
)

type AutomationHandler struct {
	db      *sql.DB
	service *services.AutomationService
}

func NewAutomationHandler(db *sql.DB, service *services.AutomationService) *AutomationHandler {
	return &AutomationHandler{db: db, service: service}
}

type RuleTarget struct {
	AccountID       int    `json:"accountId"`
	CaptionTemplate string `json:"captionTemplate"`
}

type AutomationRuleRequest struct {
	Name            string       `json:"name"`
	SourceAccountID int          `json:"sourceAccountId"`
	TriggerType     string       `json:"triggerType"`
	Filters         fiber.Map    `json:"filters"`
	Targets         []RuleTarget `json:"targets"`
}

func (h *AutomationHandler) ListRules(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	rows, err := h.db.Query(`
		SELECT id, name, source_account_id, trigger_type, filters, targets, is_active, last_run_at, created_at
		FROM automation_rules
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error")
	}
	defer rows.Close()

	type RuleResponse struct {
		ID              int             `json:"id"`
		Name            string          `json:"name"`
		SourceAccountID int             `json:"sourceAccountId"`
		TriggerType     string          `json:"triggerType"`
		Filters         json.RawMessage `json:"filters"`
		Targets         json.RawMessage `json:"targets"`
		IsActive        bool            `json:"isActive"`
		LastRunAt       *string         `json:"lastRunAt"`
		CreatedAt       string          `json:"createdAt"`
	}

	rules := make([]RuleResponse, 0)
	for rows.Next() {
		var r RuleResponse
		var filters, targets []byte
		var lastRunAt sql.NullString
		if err := rows.Scan(&r.ID, &r.Name, &r.SourceAccountID, &r.TriggerType, &filters, &targets, &r.IsActive, &lastRunAt, &r.CreatedAt); err != nil {
			continue
		}
		r.Filters = json.RawMessage(filters)
		r.Targets = json.RawMessage(targets)
		if lastRunAt.Valid {
			val := lastRunAt.String
			r.LastRunAt = &val
		}
		rules = append(rules, r)
	}

	return utils.SuccessResponse(c, rules, "")
}

func (h *AutomationHandler) CreateRule(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	var req AutomationRuleRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request")
	}

	filters, _ := json.Marshal(req.Filters)
	targets, _ := json.Marshal(req.Targets)

	var id int
	err := h.db.QueryRow(`
		INSERT INTO automation_rules (user_id, name, source_account_id, trigger_type, filters, targets)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`, userID, req.Name, req.SourceAccountID, req.TriggerType, filters, targets).Scan(&id)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to create rule")
	}

	return utils.SuccessResponse(c, fiber.Map{"id": id}, "automation rule created")
}

func (h *AutomationHandler) ToggleRule(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	id := c.Params("id")

	type ToggleRequest struct {
		Active bool `json:"isActive"`
	}
	var req ToggleRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request")
	}

	_, err := h.db.Exec(`
		UPDATE automation_rules 
		SET is_active = $1 
		WHERE id = $2 AND user_id = $3
	`, req.Active, id, userID)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to update rule")
	}

	return utils.SuccessResponse(c, nil, "rule status updated")
}

func (h *AutomationHandler) DeleteRule(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	id := c.Params("id")

	_, err := h.db.Exec(`
		DELETE FROM automation_rules 
		WHERE id = $1 AND user_id = $2
	`, id, userID)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to delete rule")
	}

	return utils.SuccessResponse(c, nil, "rule deleted")
}

// HandleYouTubeWebhook handles PubSubHubbub verification and notifications
func (h *AutomationHandler) HandleYouTubeWebhook(c *fiber.Ctx) error {
	// 1. Subscription Verification (GET)
	if c.Method() == "GET" {
		challenge := c.Query("hub.challenge")
		if challenge != "" {
			return c.SendString(challenge)
		}
		return c.SendStatus(fiber.StatusBadRequest)
	}

	// 2. New Content Notification (POST)
	// Body is XML (Atom format)
	// We'll parse this to get the video ID and channel ID
	// Then match against automation_rules

	payload := c.Body()
	if err := h.service.ProcessYouTubeEvent(payload); err != nil {
		log.Printf("Error processing YouTube webhook: %v", err)
	}

	return c.SendStatus(fiber.StatusNoContent)
}
