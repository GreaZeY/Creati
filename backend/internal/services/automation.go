package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"strings"
	"time"

	"creati.in/creati/backend/internal/logger"
	"creati.in/creati/backend/internal/utils"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

type AutomationService struct {
	db    *sql.DB
	queue *QueueService
}

type RuleTarget struct {
	AccountID       int    `json:"accountId"`
	CaptionTemplate string `json:"captionTemplate"`
}

func NewAutomationService(db *sql.DB, q *QueueService) *AutomationService {
	return &AutomationService{db: db, queue: q}
}

// YouTubeFeed represents the Atom XML feed from PubSubHubbub
type YouTubeFeed struct {
	XMLName xml.Name `xml:"feed"`
	Entry   struct {
		VideoID   string `xml:"videoId"`
		ChannelID string `xml:"channelId"`
		Title     string `xml:"title"`
		Link      struct {
			Href string `xml:"href,attr"`
		} `xml:"link"`
		Published string `xml:"published"`
		Updated   string `xml:"updated"`
	} `xml:"entry"`
}

func (s *AutomationService) ProcessYouTubeEvent(payload []byte) error {
	var feed YouTubeFeed
	if err := xml.Unmarshal(payload, &feed); err != nil {
		return fmt.Errorf("failed to unmarshal youtube xml: %w", err)
	}

	videoID := feed.Entry.VideoID
	channelID := feed.Entry.ChannelID
	title := feed.Entry.Title

	if videoID == "" || channelID == "" {
		return fmt.Errorf("missing videoId or channelId in payload")
	}

	logger.Get("automation").WithFields(logrus.Fields{
		"video_id":   videoID,
		"channel_id": channelID,
		"title":      title,
	}).Info("Processing Automation for YouTube Video")

	// 1. Find active rules for this source account (ChannelID)
	// We need to look up the platform_account ID using the platform_user_id (channelID)
	var sourceAccountID int
	err := s.db.QueryRow(`
		SELECT id FROM platform_accounts 
		WHERE platform = 'youtube' AND platform_user_id = $1
	`, channelID).Scan(&sourceAccountID)

	if err != nil {
		if err == sql.ErrNoRows {
			logger.Get("automation").WithField("channel_id", channelID).Warn("No connected account found for channel")
			return nil
		}
		return err
	}

	rows, err := s.db.Query(`
		SELECT id, action, filters, targets 
		FROM automation_rules 
		WHERE source_account_id = $1 AND is_active = true
	`, sourceAccountID)
	if err != nil {
		return err
	}
	defer rows.Close()

	traceID := uuid.New().String()

	for rows.Next() {
		var ruleID int
		var action string
		var filtersRaw, targetsRaw []byte
		if err := rows.Scan(&ruleID, &action, &filtersRaw, &targetsRaw); err != nil {
			continue
		}

		// 2. Apply Filters
		var filters map[string]interface{}
		json.Unmarshal(filtersRaw, &filters)

		if !s.matchFilters(title, filters) {
			logger.Get("automation").WithFields(logrus.Fields{
				"rule_id":  ruleID,
				"video_id": videoID,
			}).Debug("Filters did not match")
			continue
		}

		// 3. Dispatch based on action
		var targets []struct {
			AccountID       int    `json:"accountId"`
			CaptionTemplate string `json:"captionTemplate"`
			Platform        string `json:"targetPlatform"`   // For notify
			Identifier      string `json:"targetIdentifier"` // For notify
		}
		json.Unmarshal(targetsRaw, &targets)

		if action == "notify" {
			for _, target := range targets {
				s.createNotificationJob(ruleID, videoID, target.AccountID, target.Platform, target.Identifier, title, traceID)
			}
		} else {
			// Default to sync
			for _, target := range targets {
				s.createAutomationJob(ruleID, videoID, target.AccountID, title, traceID, nil)
			}
		}

		// Update last run
		s.db.Exec("UPDATE automation_rules SET last_run_at = NOW() WHERE id = $1", ruleID)
	}

	return nil
}

func (s *AutomationService) matchFilters(title string, filters map[string]interface{}) bool {
	// Simple keyword filter for now
	if keywords, ok := filters["keywords"].([]interface{}); ok && len(keywords) > 0 {
		match := false
		titleLower := strings.ToLower(title)
		for _, kw := range keywords {
			if kwStr, ok := kw.(string); ok {
				if strings.Contains(titleLower, strings.ToLower(kwStr)) {
					match = true
					break
				}
			}
		}
		if !match {
			return false
		}
	}
	return true
}

func (s *AutomationService) createAutomationJob(ruleID int, sourceVideoID string, targetAccountID int, title string, traceID string, settings *utils.ProcessingSettings) {
	ctx := context.Background()

	// 1. Fetch source platform/account details for normalization
	var sourcePlatform string
	var sourceAccountID int
	err := s.db.QueryRow(`
		SELECT pa.platform, pa.id 
		FROM automation_rules ar
		JOIN platform_accounts pa ON ar.source_account_id = pa.id
		WHERE ar.id = $1
	`, ruleID).Scan(&sourcePlatform, &sourceAccountID)
	if err != nil {
		logger.Get("automation").WithError(err).Error("Failed to fetch source details for automation")
		return
	}

	// 3. Get target platform
	var targetPlatform string
	err = s.db.QueryRow("SELECT platform FROM platform_accounts WHERE id = $1", targetAccountID).Scan(&targetPlatform)
	if err != nil {
		logger.Get("automation").WithError(err).Error("Failed to fetch target platform")
		return
	}

	// 4. Create Automation Execution (V2) - Early Insertion for accurate "Total" tracking
	var executionID string

	// Prepare settings JSON
	var settingsJSON []byte
	if settings != nil {
		settingsJSON, _ = json.Marshal(settings)
	}

	err = s.db.QueryRow(`
		INSERT INTO automation_executions 
		(rule_id, source_platform, target_platform, target_account_id, status, trace_id, processing_settings)
		VALUES ($1, $2, $3, $4, 'queued', $5, $6)
		RETURNING id
	`, ruleID, sourcePlatform, targetPlatform, targetAccountID, traceID, settingsJSON).Scan(&executionID)

	if err != nil {
		logger.Get("automation").WithError(err).Error("Failed to create automation execution skeleton")
		return
	}

	// 5. Normalize Content (V2)
	normalizer := NewContentNormalizer(s.db)
	normalized, err := normalizer.NormalizeContent(ctx, sourcePlatform, sourceVideoID, title, "", 0, "")
	if err != nil {
		logger.Get("automation").WithField("execution_id", executionID).WithError(err).Error("Failed to normalize content for automation")
		s.db.Exec("UPDATE automation_executions SET status = 'failed', error = $1 WHERE id = $2", err.Error(), executionID)
		return
	}

	// 6. Update Execution with Content ID & Enqueue for Upload
	_, err = s.db.ExecContext(ctx, "UPDATE automation_executions SET content_id = $1 WHERE id = $2", normalized.ContentID, executionID)
	if err != nil {
		logger.Get("automation").WithField("execution_id", executionID).WithError(err).Error("Failed to link content to execution")
		s.db.Exec("UPDATE automation_executions SET status = 'failed', error = $1 WHERE id = $2", "db link error", executionID)
		return
	}

	// 7. Enqueue V2 Payload
	payload, _ := json.Marshal(map[string]interface{}{
		"content_id":      normalized.ContentID,
		"target_platform": targetPlatform,
		"account_id":      targetAccountID,
		"execution_id":    executionID,
		"enqueued_at":     time.Now(),
	})

	err = s.queue.Client.LPush(ctx, QueueUpload, payload).Err()
	if err != nil {
		logger.Get("automation").WithField("execution_id", executionID).WithError(err).Error("Failed to enqueue V2 automation job")
		s.db.Exec("UPDATE automation_executions SET status = 'failed', error = $1 WHERE id = $2", "failed to enqueue", executionID)
	}

	logger.Get("automation").WithFields(logrus.Fields{
		"execution_id": executionID,
		"content_id":   normalized.ContentID,
		"target":       targetPlatform,
	}).Info("V2 Automation primed and enqueued")
}

// BlastVideos initiates a one-off distribution of multiple past videos
func (s *AutomationService) BlastVideos(userID int, clientID *int, sourceAccountID int, videoIDs []string, targets []RuleTarget, videoSettings map[string]*utils.ProcessingSettings) (int, error) {
	// 1. Create a "Manual" rule to link these jobs (unique for each blast)
	var ruleID int
	name := fmt.Sprintf("Quick Blast - %s", time.Now().Format("Jan 02, 15:04"))

	targetsJSON, _ := json.Marshal(targets)

	err := s.db.QueryRow(`
		INSERT INTO automation_rules (user_id, client_id, name, source_account_id, trigger_type, filters, targets, is_active)
		VALUES ($1, $2, $3, $4, 'manual', '{}', $5, false)
		RETURNING id
	`, userID, clientID, name, sourceAccountID, targetsJSON).Scan(&ruleID)

	if err != nil {
		return 0, fmt.Errorf("failed to create blast rule: %w", err)
	}

	// 2. Enqueue jobs for each video and each target
	traceID := uuid.New().String()
	for _, videoID := range videoIDs {
		// Try to fetch the most descriptive title from our records
		var title string
		err := s.db.QueryRow(`
			SELECT title FROM (
				SELECT c.title FROM contents c
				JOIN platform_contents pc ON pc.content_id = c.id
				WHERE pc.platform_content_id = $1
				UNION
				SELECT title FROM videos WHERE external_id = $1
			) t WHERE title IS NOT NULL AND title != '' AND title != 'Archive Blast Video'
			LIMIT 1
		`, videoID).Scan(&title)
		if err != nil {
			title = "Archive Blast Video"
		}

		// Use the same trace_id for the entire blast
		for _, target := range targets {
			settings := videoSettings[videoID]
			s.createAutomationJob(ruleID, videoID, target.AccountID, title, traceID, settings)
		}
	}

	return ruleID, nil
}
func (s *AutomationService) RetryExecution(ctx context.Context, executionID string) error {
	// 1. Fetch details for re-queueing
	var contentID, targetPlatform, traceID string
	var targetAccountID int
	err := s.db.QueryRow(`
		SELECT content_id, target_platform, target_account_id, trace_id
		FROM automation_executions WHERE id = $1
	`, executionID).Scan(&contentID, &targetPlatform, &targetAccountID, &traceID)

	if err != nil {
		return err
	}

	// 2. Update status to queued
	_, err = s.db.ExecContext(ctx, "UPDATE automation_executions SET status = 'queued', error = NULL WHERE id = $1", executionID)
	if err != nil {
		return err
	}

	// 3. Enqueue to V2 Upload Queue
	payload, _ := json.Marshal(map[string]interface{}{
		"content_id":      contentID,
		"target_platform": targetPlatform,
		"account_id":      targetAccountID,
		"execution_id":    executionID,
		"enqueued_at":     time.Now(),
	})

	return s.queue.Client.LPush(ctx, QueueUpload, payload).Err()
}

func (s *AutomationService) RetryRule(ctx context.Context, ruleID int) error {
	// 1. Fetch all failed executions for this rule
	rows, err := s.db.QueryContext(ctx, `
		SELECT id FROM automation_executions 
		WHERE rule_id = $1 AND status = 'failed'
	`, ruleID)
	if err != nil {
		return err
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var executionID string
		if err := rows.Scan(&executionID); err != nil {
			continue
		}

		// Use existing RetryExecution logic for each
		if err := s.RetryExecution(ctx, executionID); err == nil {
			count++
		}
	}

	if count == 0 {
		return fmt.Errorf("no failed executions found to retry")
	}

	return nil
}

func (s *AutomationService) createNotificationJob(ruleID int, sourceVideoID string, targetAccountID int, targetPlatform, targetIdentifier, title string, traceID string) {
	ctx := context.Background()

	// 1. Fetch source details
	var sourcePlatform string
	var sourceAccountID int
	err := s.db.QueryRow(`
		SELECT pa.platform, pa.id 
		FROM automation_rules ar
		JOIN platform_accounts pa ON ar.source_account_id = pa.id
		WHERE ar.id = $1
	`, ruleID).Scan(&sourcePlatform, &sourceAccountID)
	if err != nil {
		logger.Get("automation").WithError(err).Error("Failed to fetch source details for notification")
		return
	}

	// 2. Create Automation Execution for tracking (using existing table)
	var executionID string
	err = s.db.QueryRow(`
		INSERT INTO automation_executions 
		(rule_id, source_platform, target_platform, target_account_id, status, trace_id)
		VALUES ($1, $2, $3, $4, 'queued', $5)
		RETURNING id
	`, ruleID, sourcePlatform, targetPlatform, targetAccountID, traceID).Scan(&executionID)

	if err != nil {
		logger.Get("automation").WithError(err).Error("Failed to create notification execution record")
		return
	}

	// 3. Normalize Content
	normalizer := NewContentNormalizer(s.db)
	normalized, err := normalizer.NormalizeContent(ctx, sourcePlatform, sourceVideoID, title, "", 0, "")
	if err != nil {
		logger.Get("automation").WithField("execution_id", executionID).WithError(err).Error("Failed to normalize content for notification")
		s.db.Exec("UPDATE automation_executions SET status = 'failed', error = $1 WHERE id = $2", err.Error(), executionID)
		return
	}

	// 4. Update Execution
	s.db.ExecContext(ctx, "UPDATE automation_executions SET content_id = $1 WHERE id = $2", normalized.ContentID, executionID)

	// 5. Enqueue for Notification Worker
	// We'll reuse the audience_notification queue but with our execution_id
	payload, _ := json.Marshal(map[string]interface{}{
		"content_id":        normalized.ContentID,
		"rule_id":           ruleID,
		"execution_id":      executionID,
		"target_platform":   targetPlatform,
		"target_identifier": targetIdentifier,
		"is_unified":        true,
		"trace_id":          traceID,
	})

	err = s.queue.Client.LPush(ctx, "audience_notification", payload).Err()
	if err != nil {
		logger.Get("automation").WithField("execution_id", executionID).WithError(err).Error("Failed to enqueue notification job")
		s.db.Exec("UPDATE automation_executions SET status = 'failed', error = $1 WHERE id = $2", "failed to enqueue", executionID)
	}

	logger.Get("automation").WithFields(logrus.Fields{
		"execution_id": executionID,
		"target":       targetPlatform,
	}).Info("Unified Notification enqueued")
}
