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

	// 1. Convert RuleID to int
	var ruleID int
	switch v := job.RuleID.(type) {
	case float64:
		ruleID = int(v)
	case int:
		ruleID = v
	case string:
		fmt.Sscanf(v, "%d", &ruleID)
	default:
		return fmt.Errorf("invalid rule_id type: %T", job.RuleID)
	}

	// 2. Fetch Context
	log.Printf("[AudienceWorker] Processing job for ContentID: %s, RuleID: %d, Platform: %s", job.ContentID, ruleID, job.TargetPlatform)

	notificationContext, err := w.AudienceService.GetNotificationContext(ctx, job.ContentID, ruleID, job.TargetPlatform)
	if err != nil {
		return w.SendToDLQ(ctx, "audience_notification_dlq", payload, fmt.Errorf("failed to get context: %w", err))
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
	if err := platformService.Notify(ctx, notificationContext.Target, notificationContext.Content); err != nil {
		log.Printf("[AudienceWorker] Failed to notify %s: %v", targetPlatform, err)
		return err
	}

	// 5. Log Success/Update Execution
	if job.ExecutionID != "" {
		w.db.Exec("UPDATE automation_executions SET status = 'completed', updated_at = NOW() WHERE id = $1", job.ExecutionID)
	}

	return w.AudienceService.LogNotification(ctx, job.ContentID, ruleID, targetPlatform, "sent", "")
}
