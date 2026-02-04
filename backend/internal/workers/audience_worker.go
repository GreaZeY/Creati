package workers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"

	"creati.in/creati/backend/internal/services"
)

type AudienceNotificationWorker struct {
	BaseWorker
	AudienceService *services.AudienceService
	db              *sql.DB
}

func NewAudienceNotificationWorker(audienceService *services.AudienceService, db *sql.DB, queueSvc *services.QueueService) *AudienceNotificationWorker {
	return &AudienceNotificationWorker{
		BaseWorker:      BaseWorker{QueueSvc: queueSvc},
		AudienceService: audienceService,
		db:              db,
	}
}

type AudienceJobPayload struct {
	ContentID        string `json:"content_id"`
	RuleID           any    `json:"rule_id"`   // Can be UUID (string) or SERIAL (int)
	TargetID         string `json:"target_id"` // Legacy
	ExecutionID      string `json:"execution_id"`
	TargetPlatform   string `json:"target_platform"`   // Unified
	TargetIdentifier string `json:"target_identifier"` // Unified
	IsUnified        bool   `json:"is_unified"`
}

func (w *AudienceNotificationWorker) Name() string {
	return "AudienceNotificationWorker"
}

func (w *AudienceNotificationWorker) Queue() string {
	return "audience_notification"
}

func (w *AudienceNotificationWorker) Process(ctx context.Context, payload []byte) error {
	var job AudienceJobPayload
	if err := json.Unmarshal(payload, &job); err != nil {
		return fmt.Errorf("failed to unmarshal job: %w", err)
	}

	// 1. Fetch Context
	var notificationContext *services.NotificationContext
	var err error

	if job.IsUnified {
		log.Printf("[AudienceWorker] Processing UNIFIED job for ContentID: %s, RuleID: %v, Platform: %s", job.ContentID, job.RuleID, job.TargetPlatform)
		notificationContext, err = w.fetchUnifiedContext(ctx, job)
	} else {
		log.Printf("[AudienceWorker] Processing LEGACY job for ContentID: %s, TargetID: %s", job.ContentID, job.TargetID)
		notificationContext, err = w.AudienceService.GetNotificationContext(ctx, job.ContentID, job.TargetID)
	}

	if err != nil {
		return w.SendToDLQ(ctx, "audience_notification_dlq", payload, fmt.Errorf("failed to get context: %w", err))
	}

	// 2. Cycle Check (Double check)
	if notificationContext.Rule.SourcePlatform == notificationContext.Target.TargetPlatform {
		return fmt.Errorf("cycle detected: source platform matches target platform")
	}

	// 3. Get platform service for the target
	targetPlatform := notificationContext.Target.TargetPlatform
	var platformService services.Platform

	switch targetPlatform {
	case "discord":
		platformService = services.NewDiscordService(w.db)
	case "twitter", "x":
		platformService = services.NewTwitterService(w.db)
	case "reddit":
		platformService = services.NewRedditService(w.db)
	case "facebook":
		platformService = services.NewFacebookService(w.db)
	case "linkedin":
		platformService = services.NewLinkedInService(w.db)
	case "youtube":
		platformService = services.NewYouTubeService(w.db)
	case "instagram":
		platformService = services.NewInstagramService(w.db)
	default:
		return w.SendToDLQ(ctx, "audience_notification_dlq", payload, fmt.Errorf("unsupported platform: %s", targetPlatform))
	}

	// 4. Execute Notification
	if err := platformService.Notify(ctx, notificationContext.Target, notificationContext.Template, notificationContext.Content); err != nil {
		log.Printf("[AudienceWorker] Failed to notify %s: %v", targetPlatform, err)
		return err
	}

	// 5. Log Success/Update Execution
	if job.IsUnified && job.ExecutionID != "" {
		w.db.Exec("UPDATE automation_executions SET status = 'completed', updated_at = NOW() WHERE id = $1", job.ExecutionID)
	}

	ruleIDStr := fmt.Sprintf("%v", job.RuleID)
	return w.AudienceService.LogNotification(ctx, job.ContentID, ruleIDStr, targetPlatform, "sent", "")
}

func (w *AudienceNotificationWorker) fetchUnifiedContext(ctx context.Context, job AudienceJobPayload) (*services.NotificationContext, error) {
	nc := &services.NotificationContext{}

	// 1. Fetch Rule from automation_rules
	var action string
	var targetsJSON []byte
	err := w.db.QueryRowContext(ctx, `
		SELECT user_id, name, action, targets
		FROM automation_rules WHERE id = $1
	`, job.RuleID).Scan(&nc.Rule.UserID, &nc.Rule.Name, &action, &targetsJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch unified rule: %w", err)
	}
	nc.Rule.ID = fmt.Sprintf("%v", job.RuleID)

	// 2. Fetch Content
	contentQuery := `SELECT id, user_id, title, description, s3_url, status, created_at FROM videos WHERE id = $1`
	err = w.db.QueryRowContext(ctx, contentQuery, job.ContentID).Scan(
		&nc.Content.ID, &nc.Content.UserID, &nc.Content.Title,
		&nc.Content.Description, &nc.Content.S3URL, &nc.Content.Status, &nc.Content.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch content: %w", err)
	}

	// 3. Setup Target Info (from job)
	nc.Target.TargetPlatform = job.TargetPlatform
	nc.Target.TargetIdentifier = job.TargetIdentifier

	// 4. Extract Template from Targets JSONB (Unified approach)
	var targets []struct {
		AccountID       int    `json:"accountId"`
		Platform        string `json:"targetPlatform"`
		Identifier      string `json:"targetIdentifier"`
		TitleTemplate   string `json:"titleTemplate"`
		BodyTemplate    string `json:"bodyTemplate"`
		CaptionTemplate string `json:"captionTemplate"`
	}
	json.Unmarshal(targetsJSON, &targets)

	found := false
	for _, t := range targets {
		if t.Platform == job.TargetPlatform && t.Identifier == job.TargetIdentifier {
			nc.Template.TitleTemplate = t.TitleTemplate
			nc.Template.BodyTemplate = t.BodyTemplate
			if nc.Template.BodyTemplate == "" {
				nc.Template.BodyTemplate = t.CaptionTemplate // Fallback
			}
			found = true
			break
		}
	}

	if !found || nc.Template.BodyTemplate == "" {
		// Fallback placeholder template
		nc.Template.TitleTemplate = "New content: {{title}}"
		if nc.Template.BodyTemplate == "" {
			nc.Template.BodyTemplate = "Check out my new video: {{title}} at {{url}}"
		}
		nc.Template.MediaPolicy = "thumbnail"
	}

	return nc, nil
}
