package api

import (
	"database/sql"
	"encoding/json"
	"log"
	"strconv"
	"fmt"

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


type RuleTarget struct {
	AccountID       int    `json:"accountId"`
	TargetPlatform  string `json:"targetPlatform"`
	CaptionTemplate string `json:"captionTemplate"` // For sync (media caption)
	TitleTemplate   string `json:"titleTemplate"`   // For notify (announcement title)
	BodyTemplate    string `json:"bodyTemplate"`    // For notify (announcement body)
}

type AutomationRuleRequest struct {
	Action          string       `json:"action"` // "sync" or "notify"
	Name            string       `json:"name"`
	SourceAccountID int          `json:"sourceAccountId"`
	TriggerType     string       `json:"triggerType"`
	Filters         fiber.Map    `json:"filters"`
	Targets         []RuleTarget `json:"targets"`
	Metadata        fiber.Map    `json:"metadata"`
}

func (h *AutomationHandler) ListRules(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	clientIDStr := c.Query("clientId")
	var clientID *int
	if clientIDStr != "" {
		if cid, err := strconv.Atoi(clientIDStr); err == nil {
			clientID = &cid
		}
	}

	query := `
		SELECT 
			ar.id, ar.name, ar.source_account_id, ar.trigger_type, ar.filters, ar.targets, ar.is_active, ar.last_run_at, ar.created_at,
			ar.action, ar.metadata,
			pa.profile_name, pa.handle, pa.platform
		FROM automation_rules ar
		LEFT JOIN platform_accounts pa ON ar.source_account_id = pa.id
		WHERE ar.user_id = $1 AND ar.trigger_type != 'manual'
	`
	args := []interface{}{userID}
	if clientID != nil {
		query += " AND ar.client_id = $2"
		args = append(args, *clientID)
	} else {
		query += " AND ar.client_id IS NULL"
	}
	query += " ORDER BY ar.created_at DESC"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error", err)
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
		Action        string           `json:"action"`
		Name          string           `json:"name"`
		SourceAccount AccountInfo      `json:"sourceAccount"`
		TriggerType   string           `json:"triggerType"`
		Filters       json.RawMessage  `json:"filters"`
		Targets       []TargetWithInfo `json:"targets"`
		Metadata      json.RawMessage  `json:"metadata"`
		IsActive      bool             `json:"isActive"`
		LastRunAt     *string          `json:"lastRunAt"`
		CreatedAt     string           `json:"createdAt"`
	}

	rules := make([]RuleResponse, 0)
	for rows.Next() {
		var r RuleResponse
		var action string
		var metadata []byte
		var filters, targets []byte
		var lastRunAt sql.NullString
		var sourceProfileName, sourceHandle, sourcePlatform sql.NullString
		var sourceAccountID int

		if err := rows.Scan(
			&r.ID, &r.Name, &sourceAccountID, &r.TriggerType, &filters, &targets, &r.IsActive, &lastRunAt, &r.CreatedAt,
			&action, &metadata,
			&sourceProfileName, &sourceHandle, &sourcePlatform,
		); err != nil {
			continue
		}
		r.Action = action
		r.Metadata = json.RawMessage(metadata)

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

		rules = append(rules, r)
	}

	return utils.SuccessResponse(c, rules, "")
}

func (h *AutomationHandler) CreateRule(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	var req AutomationRuleRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request", err)
	}

	filters, _ := json.Marshal(req.Filters)
	targets, _ := json.Marshal(req.Targets)
	metadata, _ := json.Marshal(req.Metadata)
	if metadata == nil {
		metadata = []byte("{}")
	}

	clientIDStr := c.Query("clientId")
	var clientID *int
	if clientIDStr != "" {
		if cid, err := strconv.Atoi(clientIDStr); err == nil {
			clientID = &cid
		}
	}

	if req.Action == "" {
		req.Action = "sync"
	}

	var id int
	err := h.db.QueryRow(`
		INSERT INTO automation_rules (user_id, client_id, name, source_account_id, trigger_type, filters, targets, action, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id
	`, userID, clientID, req.Name, req.SourceAccountID, req.TriggerType, filters, targets, req.Action, metadata).Scan(&id)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to create rule", err)
	}

	return utils.SuccessResponse(c, fiber.Map{"id": id}, "automation rule created")
}

func (h *AutomationHandler) UpdateRule(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	id := c.Params("id")

	var req AutomationRuleRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request", err)
	}

	filters, _ := json.Marshal(req.Filters)
	targets, _ := json.Marshal(req.Targets)
	metadata, _ := json.Marshal(req.Metadata)

	_, err := h.db.Exec(`
		UPDATE automation_rules 
		SET name = $1, filters = $2, targets = $3, metadata = $4, action = $5, updated_at = NOW()
		WHERE id = $6 AND user_id = $7
	`, req.Name, filters, targets, metadata, req.Action, id, userID)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to update rule", err)
	}

	return utils.SuccessResponse(c, nil, "rule updated")
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
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to update rule", err)
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
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to delete rule", err)
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

	clientIDStr := c.Query("clientId")
	var clientID *int
	if clientIDStr != "" {
		if cid, err := strconv.Atoi(clientIDStr); err == nil {
			clientID = &cid
		}
	}

	ruleID, err := h.service.BlastVideos(userID, clientID, req.SourceAccountID, req.VideoIDs, req.Targets)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to initiate blast", err)
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
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to retry execution", err)
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
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, err.Error(), err)
	}

	return utils.SuccessResponse(c, nil, "Operational sectors re-primed for dispatch! ⚡")
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
	payload := c.Body()
	if err := h.service.ProcessYouTubeEvent(payload); err != nil {
		log.Printf("Error processing YouTube webhook: %v", err)
	}

	return c.SendStatus(fiber.StatusNoContent)
}

	type JobContent struct {
		ID    string `json:"id"`
		Title string `json:"title"`
	}

	type JobTarget struct {
		Handle       string `json:"handle"`
		Platform     string `json:"platform"`
		Status       string `json:"status"`
		Error        string `json:"error,omitempty"`
		ContentTitle string `json:"contentTitle"` // Associated content for this specific execution
	}

	type UnifiedJob struct {
		ID            string       `json:"id"`
		JobType       string       `json:"jobType"`
		RuleID        int          `json:"ruleId"`
		RuleName      string       `json:"ruleName"`
		Status        string       `json:"status"`
		Progress      string       `json:"progress"`
		Sources       []JobTarget  `json:"sources"` // Changed to array for extensibility
		Targets       []JobTarget  `json:"targets"`
		Contents      []JobContent `json:"contents"` // Changed from single fields to array
		ErrorMessage  string       `json:"errorMessage,omitempty"`
		CreatedAt     string       `json:"createdAt"`
	}

	func (h *AutomationHandler) ListJobs(c *fiber.Ctx) error {
		userID := middleware.GetUserID(c)
		limit := c.QueryInt("limit", 20)
		offset := c.QueryInt("offset", 0)

		// Determine if client-specific query
		clientIDStr := c.Query("clientId")
		var clientID *int
		if clientIDStr != "" {
			if cid, err := strconv.Atoi(clientIDStr); err == nil {
				clientID = &cid
			}
		}

		// Base filter
		ruleFilter := "r.user_id = $1"
		args := []interface{}{userID}
		if clientID != nil {
			ruleFilter += " AND r.client_id = $2"
			args = append(args, *clientID)
		} else {
			ruleFilter += " AND r.client_id IS NULL"
		}

		query := fmt.Sprintf(`
			SELECT 
				COALESCE(e.trace_id::text, e.id::text) as id, 
				'sync' as job_type, 
				MAX(e.rule_id) as rule_id, 
				MAX(r.name) as name, 
				
				-- Aggregate Status Logic
				CASE 
					WHEN COUNT(*) = COUNT(*) FILTER (WHERE e.status = 'completed') THEN 'success'
					WHEN COUNT(*) = COUNT(*) FILTER (WHERE e.status = 'failed') THEN 'failed'
					WHEN COUNT(*) = COUNT(*) FILTER (WHERE e.status = 'queued') THEN 'queued'
					WHEN COUNT(*) FILTER (WHERE e.status = 'failed') > 0 THEN 'partial'
					ELSE 'processing'
				END as status,

				-- Progress
				(COUNT(*) FILTER (WHERE e.status IN ('completed', 'failed')))::text || '/' || COUNT(*)::text as progress,

				-- JSON Array of Sources (currently single, but extensible)
				json_agg(DISTINCT jsonb_build_object(
					'handle', COALESCE(spa.handle, spa.profile_name, e.source_platform),
					'platform', e.source_platform,
					'status', 'active' 
				)) as sources,

				-- JSON Array of Targets (Executions)
				json_agg(json_build_object(
					'handle', COALESCE(tpa.handle, tpa.profile_name, e.target_platform),
					'platform', e.target_platform,
					'status', e.status,
					'error', COALESCE(e.error, ''),
					'contentTitle', COALESCE(c.title, 'Unknown')
				)) as targets,

				-- JSON Array of Distinct Contents
				json_agg(DISTINCT jsonb_build_object(
					'id', e.content_id, 
					'title', COALESCE(c.title, 'Unknown')
				)) as contents,

				MAX(e.created_at) as created_at

			FROM automation_executions e
			JOIN automation_rules r ON e.rule_id = r.id
			LEFT JOIN contents c ON e.content_id = c.id
			LEFT JOIN platform_accounts spa ON r.source_account_id = spa.id 
			LEFT JOIN platform_accounts tpa ON e.target_account_id = tpa.id
			WHERE %s
			GROUP BY COALESCE(e.trace_id::text, e.id::text)
			
			UNION ALL
			
			-- Logs
			SELECT 
				COALESCE(l.trace_id::text, l.id::text), 'notify', MAX(l.rule_id), MAX(r.name), 
				CASE 
					WHEN COUNT(*) = COUNT(*) FILTER (WHERE l.status = 'completed') THEN 'success'
					WHEN COUNT(*) = COUNT(*) FILTER (WHERE l.status = 'failed') THEN 'failed'
					WHEN COUNT(*) FILTER (WHERE l.status = 'failed') > 0 THEN 'partial'
					ELSE 'success' -- Default for single notifications
				END, 
				(COUNT(*) FILTER (WHERE l.status IN ('completed', 'failed')))::text || '/' || COUNT(*)::text as progress,
				json_agg(DISTINCT jsonb_build_object(
					'handle', COALESCE(spa.handle, spa.profile_name, spa.platform),
					'platform', spa.platform,
					'status', 'active'
				)),
				json_agg(json_build_object(
					'handle', l.target_platform,
					'platform', l.target_platform,
					'status', l.status,
					'error', COALESCE(l.error_message, ''),
					'contentTitle', COALESCE(v.title, 'Unknown')
				)),
				json_agg(DISTINCT jsonb_build_object(
					'id', l.content_id, 
					'title', COALESCE(v.title, 'Unknown')
				)),
				MAX(l.created_at)
			FROM automation_logs l
			JOIN automation_rules r ON l.rule_id = r.id
			JOIN platform_accounts spa ON r.source_account_id = spa.id
			LEFT JOIN videos v ON l.content_id = v.id
			WHERE %s
			GROUP BY COALESCE(l.trace_id::text, l.id::text)
			
			ORDER BY created_at DESC
			LIMIT $%d OFFSET $%d
		`, ruleFilter, ruleFilter, len(args)+1, len(args)+2)

		// Add pagination args
		args = append(args, limit, offset)

		rows, err := h.db.Query(query, args...)
		if err != nil {
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error", err)
		}
		defer rows.Close()

		jobs := make([]UnifiedJob, 0)
		for rows.Next() {
			var j UnifiedJob
			var sourcesJSON, targetsJSON, contentsJSON []byte
			
			if err := rows.Scan(
				&j.ID, &j.JobType, &j.RuleID, &j.RuleName, &j.Status,
				&j.Progress,
				&sourcesJSON,
				&targetsJSON,
				&contentsJSON,
				&j.CreatedAt,
			); err != nil {
				continue
			}

			if err := json.Unmarshal(sourcesJSON, &j.Sources); err != nil {
				j.Sources = []JobTarget{}
			}
			if err := json.Unmarshal(targetsJSON, &j.Targets); err != nil {
				j.Targets = []JobTarget{}
			}
			if err := json.Unmarshal(contentsJSON, &j.Contents); err != nil {
				j.Contents = []JobContent{}
			}

			jobs = append(jobs, j)
		}

		return utils.SuccessResponse(c, jobs, "")
	}
