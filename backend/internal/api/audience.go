package api

import (
	"database/sql"

	"creati.in/creati/backend/internal/db/models"
	"creati.in/creati/backend/internal/middleware"
	"creati.in/creati/backend/internal/utils"
	"github.com/gofiber/fiber/v2"
)

type AudienceHandler struct {
	db *sql.DB
}

func NewAudienceHandler(db *sql.DB) *AudienceHandler {
	return &AudienceHandler{db: db}
}

type AudienceRuleRequest struct {
	Name           string                      `json:"name"`
	SourcePlatform string                      `json:"source_platform"`
	EventType      string                      `json:"event_type"`
	Targets        []models.NotificationTarget `json:"targets"`
}

type AudienceRuleResponse struct {
	models.NotificationRule
	Targets []models.NotificationTarget `json:"targets"`
}

// ListRules - GET /api/audience/rules
func (h *AudienceHandler) ListRules(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	// TODO: Add client_id support when ready, currently user-centric

	rows, err := h.db.Query(`
		SELECT id, user_id, name, source_platform, event_type, enabled, created_at
		FROM audience_notification_rules
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error", err)
	}
	defer rows.Close()

	rules := []AudienceRuleResponse{}

	for rows.Next() {
		var r AudienceRuleResponse
		if err := rows.Scan(&r.ID, &r.UserID, &r.Name, &r.SourcePlatform, &r.EventType, &r.Enabled, &r.CreatedAt); err != nil {
			continue
		}

		// Fetch Targets
		// (N+1 query is fine for low volume rules)
		tRows, err := h.db.Query(`
			SELECT id, rule_id, target_platform, target_identifier, created_at
			FROM audience_notification_targets
			WHERE rule_id = $1
		`, r.ID)
		if err == nil {
			for tRows.Next() {
				var t models.NotificationTarget
				if err := tRows.Scan(&t.ID, &t.RuleID, &t.TargetPlatform, &t.TargetIdentifier, &t.CreatedAt); err == nil {
					r.Targets = append(r.Targets, t)
				}
			}
			tRows.Close()
		}

		rules = append(rules, r)
	}

	return utils.SuccessResponse(c, rules, "")
}

// CreateRule - POST /api/audience/rules
func (h *AudienceHandler) CreateRule(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	var req AudienceRuleRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request")
	}

	tx, err := h.db.Begin()
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "transaction failed", err)
	}

	var ruleID string
	err = tx.QueryRow(`
		INSERT INTO audience_notification_rules (user_id, name, source_platform, event_type, enabled)
		VALUES ($1, $2, $3, $4, true)
		RETURNING id
	`, userID, req.Name, req.SourcePlatform, req.EventType).Scan(&ruleID)

	if err != nil {
		tx.Rollback()
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to create rule", err)
	}

	for _, t := range req.Targets {
		_, err := tx.Exec(`
			INSERT INTO audience_notification_targets (rule_id, target_platform, target_identifier)
			VALUES ($1, $2, $3)
		`, ruleID, t.TargetPlatform, t.TargetIdentifier)
		if err != nil {
			tx.Rollback()
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to create target", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "commit failed", err)
	}

	return utils.SuccessResponse(c, fiber.Map{"id": ruleID}, "Rule created")
}

// DeleteRule - DELETE /api/audience/rules/:id
func (h *AudienceHandler) DeleteRule(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	id := c.Params("id")

	res, err := h.db.Exec(`DELETE FROM audience_notification_rules WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "delete failed", err)
	}

	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
		return utils.ErrorResponse(c, fiber.StatusNotFound, "rule not found", nil)
	}

	return utils.SuccessResponse(c, nil, "Rule deleted")
}

// ToggleRule - PUT /api/audience/rules/:id/toggle
func (h *AudienceHandler) ToggleRule(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	id := c.Params("id")

	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request")
	}

	_, err := h.db.Exec(`UPDATE audience_notification_rules SET enabled = $1 WHERE id = $2 AND user_id = $3`, req.Enabled, id, userID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "update failed", err)
	}

	return utils.SuccessResponse(c, nil, "Status updated")
}

// GetTemplate - GET /api/audience/templates?platform=discord&ruleId=...
func (h *AudienceHandler) GetTemplate(c *fiber.Ctx) error {
	// Simple get
	ruleID := c.Query("ruleId")
	platform := c.Query("platform")

	var t models.NotificationTemplate
	err := h.db.QueryRow(`
		SELECT id, rule_id, platform, title_template, body_template 
		FROM notification_templates 
		WHERE rule_id = $1 AND platform = $2
	`, ruleID, platform).Scan(&t.ID, &t.RuleID, &t.Platform, &t.TitleTemplate, &t.BodyTemplate)

	if err == sql.ErrNoRows {
		return utils.SuccessResponse(c, nil, "No template found")
	}
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "db error", err)
	}

	return utils.SuccessResponse(c, t, "")
}

// SaveTemplate - POST /api/audience/templates
func (h *AudienceHandler) SaveTemplate(c *fiber.Ctx) error {
	var req models.NotificationTemplate
	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request")
	}

	// Upsert
	_, err := h.db.Exec(`
		INSERT INTO notification_templates (rule_id, platform, title_template, body_template)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (rule_id, platform) 
		DO UPDATE SET title_template = $3, body_template = $4
	`, req.RuleID, req.Platform, req.TitleTemplate, req.BodyTemplate)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "save failed", err)
	}

	return utils.SuccessResponse(c, nil, "Template saved")
}
