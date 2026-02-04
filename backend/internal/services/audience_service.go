package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"creati.in/creati/backend/internal/db/models"
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
	Content  models.Video
	Rule     models.NotificationRule
	Target   models.NotificationTarget
	Template models.NotificationTemplate
}

func (s *AudienceService) GetNotificationContext(ctx context.Context, contentID, targetID string) (*NotificationContext, error) {
	// 1. Fetch Target and Rule info
	query := `
		SELECT 
			t.id, t.rule_id, t.target_platform, t.target_identifier,
			r.id, r.user_id, r.client_id, r.name, r.source_platform, r.event_type
		FROM audience_notification_targets t
		JOIN audience_notification_rules r ON t.rule_id = r.id
		WHERE t.id = $1
	`

	row := s.DB.QueryRowContext(ctx, query, targetID)

	var nc NotificationContext
	if err := row.Scan(
		&nc.Target.ID, &nc.Target.RuleID, &nc.Target.TargetPlatform, &nc.Target.TargetIdentifier,
		&nc.Rule.ID, &nc.Rule.UserID, &nc.Rule.ClientID, &nc.Rule.Name, &nc.Rule.SourcePlatform, &nc.Rule.EventType,
	); err != nil {
		return nil, fmt.Errorf("failed to fetch target/rule: %w", err)
	}

	// 2. Fetch Content (Video)
	// Assuming a 'videos' table based on previous steps.
	contentQuery := `
		SELECT id, user_id, title, description, s3_url, status, created_at
		FROM videos
		WHERE id = $1
	`
	// Note: Adjusted scanning to match available fields in Video struct (removed client_id, platform_id if they caused issues, but kept standard ones)
	// Assuming Video struct fields match DB columns
	if err := s.DB.QueryRowContext(ctx, contentQuery, contentID).Scan(
		&nc.Content.ID, &nc.Content.UserID, &nc.Content.Title,
		&nc.Content.Description, &nc.Content.S3URL, &nc.Content.Status, &nc.Content.CreatedAt,
	); err != nil {
		return nil, fmt.Errorf("failed to fetch content: %w", err)
	}

	// 3. Fetch Template
	templateQuery := `
		SELECT id, title_template, body_template, media_policy
		FROM notification_templates
		WHERE rule_id = $1 AND platform = $2
	`
	if err := s.DB.QueryRowContext(ctx, templateQuery, nc.Rule.ID, nc.Target.TargetPlatform).Scan(
		&nc.Template.ID, &nc.Template.TitleTemplate, &nc.Template.BodyTemplate, &nc.Template.MediaPolicy,
	); err != nil {
		if err == sql.ErrNoRows {
			// Fallback placeholder logic could go here
			return nil, fmt.Errorf("no template found for rule %s platform %s", nc.Rule.ID, nc.Target.TargetPlatform)
		}
		return nil, fmt.Errorf("failed to fetch template: %w", err)
	}

	return &nc, nil
}

func (s *AudienceService) LogNotification(ctx context.Context, contentID, ruleID, platform, status, errMsg string) error {
	query := `
		INSERT INTO audience_notification_logs (content_id, rule_id, target_platform, status, error_message)
		VALUES ($1, $2, $3, $4, $5)
	`
	_, err := s.DB.ExecContext(ctx, query, contentID, ruleID, platform, status, errMsg)
	return err
}

// EnqueueFromContent finds matching rules for a newly created content and enqueues notification jobs
func (s *AudienceService) EnqueueFromContent(ctx context.Context, contentID string, sourcePlatform string, userID int) error {
	// 1. Find matching enabled rules
	// We check for rules where source_platform matches and user matches
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, name 
		FROM audience_notification_rules 
		WHERE user_id = $1 AND source_platform = $2 AND enabled = true
	`, userID, sourcePlatform)
	if err != nil {
		return fmt.Errorf("failed to query rules: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var ruleID string
		var ruleName string
		if err := rows.Scan(&ruleID, &ruleName); err != nil {
			continue
		}

		// 2. For each rule, get targets
		targetRows, err := s.DB.QueryContext(ctx, `
			SELECT id, target_platform 
			FROM audience_notification_targets 
			WHERE rule_id = $1
		`, ruleID)
		if err != nil {
			continue
		}
		defer targetRows.Close() // defer inside loop is risky but low volume here

		for targetRows.Next() {
			var targetID string
			var targetPlatform string
			if err := targetRows.Scan(&targetID, &targetPlatform); err != nil {
				continue
			}

			// 3. Enqueue Job
			// payload matches AudienceJobPayload in worker
			payload := map[string]string{
				"content_id": contentID,
				"rule_id":    ruleID,
				"target_id":  targetID,
			}
			jsonPayload, _ := json.Marshal(payload)

			if err := s.QueueSvc.Client.LPush(ctx, "audience_notification", jsonPayload).Err(); err != nil {
				// Initialize log as pending/failed
				s.LogNotification(ctx, contentID, ruleID, targetPlatform, "failed", "enqueue error: "+err.Error())
			} else {
				s.LogNotification(ctx, contentID, ruleID, targetPlatform, "pending", "")
			}
		}
		targetRows.Close() // Explicit close
	}
	return nil
}
