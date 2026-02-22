package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"creati.in/creati/backend/internal/db/models"
	"github.com/google/uuid"
)

type AudienceService struct {
	DB       *sql.DB
	QueueSvc *QueueService
}

func NewAudienceService(db *sql.DB, queueSvc *QueueService) *AudienceService {
	return &AudienceService{DB: db, QueueSvc: queueSvc}
}

// NotificationContext aggregates all data needed to send a notification
type NotificationContext struct {
	Content models.Video
	Rule    models.AutomationRule
	Target  models.UnifiedTarget
}

func (s *AudienceService) GetNotificationContext(ctx context.Context, contentID string, ruleID int, targetPlatform string) (*NotificationContext, error) {
	// 1. Fetch Rule
	var rule models.AutomationRule
	query := `
		SELECT id, user_id, client_id, name, targets, metadata
		FROM automation_rules
		WHERE id = $1
	`
	var targetsRaw []byte
	if err := s.DB.QueryRowContext(ctx, query, ruleID).Scan(
		&rule.ID, &rule.UserID, &rule.ClientID, &rule.Name, &targetsRaw, &rule.Metadata,
	); err != nil {
		return nil, fmt.Errorf("failed to fetch rule: %w", err)
	}

	// 2. Parse Targets to find the specific platform target
	var targets []models.UnifiedTarget
	json.Unmarshal(targetsRaw, &targets)

	var foundTarget *models.UnifiedTarget
	for _, t := range targets {
		if t.TargetPlatform == targetPlatform {
			foundTarget = &t
			break
		}
	}

	if foundTarget == nil {
		return nil, fmt.Errorf("no target found for platform %s in rule %d", targetPlatform, ruleID)
	}

	// 3. Fetch Content (Video)
	var content models.Video
	contentQuery := `
		SELECT id, user_id, title, description, s3_url, status, created_at
		FROM videos
		WHERE id = $1
	`
	if err := s.DB.QueryRowContext(ctx, contentQuery, contentID).Scan(
		&content.ID, &content.UserID, &content.Title,
		&content.Description, &content.S3URL, &content.Status, &content.CreatedAt,
	); err != nil {
		return nil, fmt.Errorf("failed to fetch content: %w", err)
	}

	return &NotificationContext{
		Content: content,
		Rule:    rule,
		Target:  *foundTarget,
	}, nil
}

// EnqueueFromContent finds matching rules for a newly created content and enqueues notification jobs
func (s *AudienceService) EnqueueFromContent(ctx context.Context, contentID string, sourcePlatform string, userID int) error {
	// 1. Find matching enabled rules by platform
	rows, err := s.DB.QueryContext(ctx, `
		SELECT ar.id, ar.name, ar.targets 
		FROM automation_rules ar
		JOIN platform_accounts pa ON ar.source_account_id = pa.id
		WHERE ar.user_id = $1 AND pa.platform = $2 AND ar.is_active = true AND ar.action = 'notify'
	`, userID, sourcePlatform)
	if err != nil {
		return fmt.Errorf("failed to query rules: %w", err)
	}
	traceID := uuid.New().String()

	for rows.Next() {
		var ruleID int
		var ruleName string
		var targetsRaw []byte
		if err := rows.Scan(&ruleID, &ruleName, &targetsRaw); err != nil {
			continue
		}

		// 2. Parse targets
		var targets []models.UnifiedTarget
		json.Unmarshal(targetsRaw, &targets)

		for _, target := range targets {
			// 3. Enqueue Job
			payload := map[string]interface{}{
				"content_id":        contentID,
				"rule_id":           ruleID,
				"target_platform":   target.TargetPlatform,
				"target_identifier": target.TargetIdentifier,
				"is_unified":        true,
				"trace_id":          traceID,
			}
			jsonPayload, _ := json.Marshal(payload)

			if err := s.QueueSvc.Client.LPush(ctx, "audience_notification", jsonPayload).Err(); err != nil {
				s.LogNotification(ctx, contentID, ruleID, target.TargetPlatform, "failed", "enqueue error: "+err.Error(), traceID)
			} else {
				s.LogNotification(ctx, contentID, ruleID, target.TargetPlatform, "pending", "", traceID)
			}
		}
	}
	return nil
}

func (s *AudienceService) LogNotification(ctx context.Context, contentID string, ruleID int, platform, status, errMsg string, traceID string) error {
	var cID int
	fmt.Sscanf(contentID, "%d", &cID)

	query := `
		INSERT INTO automation_logs (content_id, rule_id, target_platform, status, error_message, trace_id)
		VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''))
	`
	_, err := s.DB.ExecContext(ctx, query, cID, ruleID, platform, status, errMsg, traceID)
	return err
}
