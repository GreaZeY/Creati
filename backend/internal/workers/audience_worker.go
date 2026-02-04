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
	ContentID string `json:"content_id"`
	RuleID    string `json:"rule_id"`
	TargetID  string `json:"target_id"` // References audience_notification_targets table
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

	log.Printf("[AudienceWorker] Processing job for ContentID: %s, TargetID: %s", job.ContentID, job.TargetID)

	// 1. Fetch Context (Content, Target, Template)
	notificationContext, err := w.AudienceService.GetNotificationContext(ctx, job.ContentID, job.TargetID)
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

	// 5. Log Success
	return w.AudienceService.LogNotification(ctx, job.ContentID, job.RuleID, targetPlatform, "sent", "")
}
