package api

import (
	"database/sql"
	"encoding/json"
	"log"

	"creati.in/creati/backend/internal/middleware"
	"creati.in/creati/backend/internal/services"
	"creati.in/creati/backend/internal/utils"

	"github.com/gofiber/fiber/v2"
)

type AutomationHandler struct {
	db      *sql.DB
	service *services.AutomationService
}

func NewAutomationHandler(db *sql.DB, service *services.AutomationService) *AutomationHandler {
	return &AutomationHandler{db: db, service: service}
}

type BlastSummary struct {
	Pending    int               `json:"pending"`
	Processing int               `json:"processing"`
	Completed  int               `json:"completed"`
	Failed     int               `json:"failed"`
	Total      int               `json:"total"`
	Failures   map[string]string `json:"failures,omitempty"`
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
		SELECT 
			ar.id, ar.name, ar.source_account_id, ar.trigger_type, ar.filters, ar.targets, ar.is_active, ar.last_run_at, ar.created_at,
			pa.profile_name, pa.handle, pa.platform
		FROM automation_rules ar
		LEFT JOIN platform_accounts pa ON ar.source_account_id = pa.id
		WHERE ar.user_id = $1
		ORDER BY ar.created_at DESC
	`, userID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error")
	}
	defer rows.Close()

	type AccountInfo struct {
		AccountID   int    `json:"accountId"`
		ProfileName string `json:"profileName"`
		Handle      string `json:"handle"`
		Platform    string `json:"platform"`
	}

	type TargetWithInfo struct {
		AccountID       int    `json:"accountId"`
		CaptionTemplate string `json:"captionTemplate"`
		ProfileName     string `json:"profileName"`
		Handle          string `json:"handle"`
		Platform        string `json:"platform"`
	}

	type RuleResponse struct {
		ID            int              `json:"id"`
		Name          string           `json:"name"`
		SourceAccount AccountInfo      `json:"sourceAccount"`
		TriggerType   string           `json:"triggerType"`
		Filters       json.RawMessage  `json:"filters"`
		Targets       []TargetWithInfo `json:"targets"`
		IsActive      bool             `json:"isActive"`
		LastRunAt     *string          `json:"lastRunAt"`
		CreatedAt     string           `json:"createdAt"`
		Summary       *BlastSummary    `json:"summary,omitempty"`
	}

	rules := make([]RuleResponse, 0)
	for rows.Next() {
		var r RuleResponse
		var filters, targets []byte
		var lastRunAt sql.NullString
		var sourceProfileName, sourceHandle, sourcePlatform sql.NullString
		var sourceAccountID int

		if err := rows.Scan(
			&r.ID, &r.Name, &sourceAccountID, &r.TriggerType, &filters, &targets, &r.IsActive, &lastRunAt, &r.CreatedAt,
			&sourceProfileName, &sourceHandle, &sourcePlatform,
		); err != nil {
			continue
		}

		r.SourceAccount = AccountInfo{
			AccountID:   sourceAccountID,
			ProfileName: sourceProfileName.String,
			Handle:      sourceHandle.String,
			Platform:    sourcePlatform.String,
		}

		r.Filters = json.RawMessage(filters)

		// Enrich targets with account details
		var rawTargets []RuleTarget
		json.Unmarshal(targets, &rawTargets)

		enrichedTargets := make([]TargetWithInfo, 0, len(rawTargets))
		for _, t := range rawTargets {
			var profileName, handle, platform sql.NullString
			h.db.QueryRow(`SELECT profile_name, handle, platform FROM platform_accounts WHERE id = $1`, t.AccountID).Scan(&profileName, &handle, &platform)
			enrichedTargets = append(enrichedTargets, TargetWithInfo{
				AccountID:       t.AccountID,
				CaptionTemplate: t.CaptionTemplate,
				ProfileName:     profileName.String,
				Handle:          handle.String,
				Platform:        platform.String,
			})
		}
		r.Targets = enrichedTargets

		if lastRunAt.Valid {
			val := lastRunAt.String
			r.LastRunAt = &val
		}

		// Fetch summary for manual blasts
		if r.TriggerType == "manual" {
			s := &BlastSummary{Failures: make(map[string]string)}
			summaryRows, err := h.db.Query(`
					SELECT status, target_platform, error, COUNT(*) 
					FROM automation_executions 
					WHERE rule_id = $1 
					GROUP BY status, target_platform, error
				`, r.ID)
			if err == nil {
				for summaryRows.Next() {
					var status, platform string
					var errMsg sql.NullString
					var count int
					if err := summaryRows.Scan(&status, &platform, &errMsg, &count); err == nil {
						switch status {
						case "queued", "pending":
							s.Pending += count
						case "processing":
							s.Processing += count
						case "completed":
							s.Completed += count
						case "failed":
							s.Failed += count
							if errMsg.Valid && errMsg.String != "" {
								s.Failures[platform] = errMsg.String
							}
						}
						s.Total += count
					}
				}
				summaryRows.Close()
				r.Summary = s
			}
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

type BlastRequest struct {
	Name            string                `json:"name"`
	SourceAccountID int                   `json:"sourceAccountId"`
	VideoIDs        []string              `json:"videoIds"`
	Targets         []services.RuleTarget `json:"targets"`
}

func (h *AutomationHandler) HandleBlast(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	var req BlastRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request")
	}

	if len(req.VideoIDs) == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "no videos selected")
	}

	if len(req.Targets) == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "no targets selected")
	}

	ruleID, err := h.service.BlastVideos(userID, req.SourceAccountID, req.VideoIDs, req.Targets)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to initiate blast")
	}

	return utils.SuccessResponse(c, fiber.Map{"ruleID": ruleID}, "Quick Blast initiated successfully! 🚀")
}

func (h *AutomationHandler) RetryExecution(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	executionID := c.Params("id")

	// Verify ownership through rule
	var exists bool
	err := h.db.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM automation_executions e
			JOIN automation_rules r ON e.rule_id = r.id
			WHERE e.id = $1 AND r.user_id = $2
		)
	`, executionID, userID).Scan(&exists)

	if err != nil || !exists {
		return utils.ErrorResponse(c, fiber.StatusNotFound, "execution not found")
	}

	err = h.service.RetryExecution(c.Context(), executionID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to retry execution")
	}

	return utils.SuccessResponse(c, nil, "Retry initiated! 🚀")
}

func (h *AutomationHandler) RetryRule(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	ruleID, _ := c.ParamsInt("id")

	// Verify ownership
	var exists bool
	err := h.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM automation_rules WHERE id = $1 AND user_id = $2)`, ruleID, userID).Scan(&exists)
	if err != nil || !exists {
		return utils.ErrorResponse(c, fiber.StatusNotFound, "blast history not found")
	}

	err = h.service.RetryRule(c.Context(), ruleID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, err.Error())
	}

	return utils.SuccessResponse(c, nil, "Operational sectors re-primed for dispatch! ⚡")
}

func (h *AutomationHandler) GetRuleJobSummary(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	ruleID := c.Params("id")

	// Verify rule belongs to user
	var exists bool
	err := h.db.QueryRow("SELECT EXISTS(SELECT 1 FROM automation_rules WHERE id = $1 AND user_id = $2)", ruleID, userID).Scan(&exists)
	if err != nil || !exists {
		return utils.ErrorResponse(c, fiber.StatusNotFound, "blast not found")
	}

	rows, err := h.db.Query(`
		SELECT status, target_platform, error, COUNT(*) 
		FROM automation_executions 
		WHERE rule_id = $1 
		GROUP BY status, target_platform, error
	`, ruleID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error")
	}
	defer rows.Close()

	s := &BlastSummary{Failures: make(map[string]string)}
	for rows.Next() {
		var status, platform string
		var errMsg sql.NullString
		var count int
		if err := rows.Scan(&status, &platform, &errMsg, &count); err == nil {
			switch status {
			case "queued", "pending":
				s.Pending += count
			case "processing":
				s.Processing += count
			case "completed":
				s.Completed += count
			case "failed":
				s.Failed += count
				if errMsg.Valid && errMsg.String != "" {
					s.Failures[platform] = errMsg.String
				}
			}
			s.Total += count
		}
	}

	return utils.SuccessResponse(c, s, "Summary retrieved")
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
