package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"log"
	"strings"
	"time"
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

	log.Printf("Processing Automation for YouTube Video: %s (Channel: %s, Title: %s)", videoID, channelID, title)

	// 1. Find active rules for this source account (ChannelID)
	// We need to look up the platform_account ID using the platform_user_id (channelID)
	var sourceAccountID int
	err := s.db.QueryRow(`
		SELECT id FROM platform_accounts 
		WHERE platform = 'youtube' AND platform_user_id = $1
	`, channelID).Scan(&sourceAccountID)

	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("No connected account found for channel: %s", channelID)
			return nil
		}
		return err
	}

	rows, err := s.db.Query(`
		SELECT id, filters, targets 
		FROM automation_rules 
		WHERE source_account_id = $1 AND is_active = true
	`, sourceAccountID)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var ruleID int
		var filtersRaw, targetsRaw []byte
		if err := rows.Scan(&ruleID, &filtersRaw, &targetsRaw); err != nil {
			continue
		}

		// 2. Apply Filters
		var filters map[string]interface{}
		json.Unmarshal(filtersRaw, &filters)

		if !s.matchFilters(title, filters) {
			log.Printf("Rule %d: Filters did not match for video %s", ruleID, videoID)
			continue
		}

		// 3. Create Jobs for each target
		var targets []struct {
			AccountID       int    `json:"accountId"`
			CaptionTemplate string `json:"captionTemplate"`
		}
		json.Unmarshal(targetsRaw, &targets)

		for _, target := range targets {
			s.createAutomationJob(ruleID, videoID, target.AccountID, title)
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

func (s *AutomationService) createAutomationJob(ruleID int, sourceVideoID string, targetAccountID int, title string) {
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
		log.Printf("Failed to fetch source details for automation: %v", err)
		return
	}

	// 3. Get target platform
	var targetPlatform string
	err = s.db.QueryRow("SELECT platform FROM platform_accounts WHERE id = $1", targetAccountID).Scan(&targetPlatform)
	if err != nil {
		log.Printf("Failed to fetch target platform: %v", err)
		return
	}

	// 4. Create Automation Execution (V2) - Early Insertion for accurate "Total" tracking
	var executionID string
	err = s.db.QueryRow(`
		INSERT INTO automation_executions 
		(rule_id, source_platform, target_platform, target_account_id, status, trace_id)
		VALUES ($1, $2, $3, $4, 'queued', gen_random_uuid())
		RETURNING id
	`, ruleID, sourcePlatform, targetPlatform, targetAccountID).Scan(&executionID)

	if err != nil {
		log.Printf("Failed to create automation execution skeleton: %v", err)
		return
	}

	// 5. Normalize Content (V2)
	normalizer := NewContentNormalizer(s.db)
	normalized, err := normalizer.NormalizeContent(ctx, sourcePlatform, sourceVideoID, sourceAccountID, title, "", 0, "")
	if err != nil {
		log.Printf("Failed to normalize content for automation %s: %v", executionID, err)
		s.db.Exec("UPDATE automation_executions SET status = 'failed', error = $1 WHERE id = $2", err.Error(), executionID)
		return
	}

	// 6. Update Execution with Content ID & Enqueue for Upload
	_, err = s.db.ExecContext(ctx, "UPDATE automation_executions SET content_id = $1 WHERE id = $2", normalized.ContentID, executionID)
	if err != nil {
		log.Printf("Failed to link content to execution %s: %v", executionID, err)
		s.db.Exec("UPDATE automation_executions SET status = 'failed', error = $1 WHERE id = $2", "db link error", executionID)
		return
	}

	// 7. Enqueue V2 Payload
	payload, _ := json.Marshal(map[string]interface{}{
		"content_id":      normalized.ContentID,
		"target_platform": targetPlatform,
		"account_id":      targetAccountID,
		"execution_id":    executionID,
	})

	err = s.queue.Client.LPush(ctx, QueueUpload, payload).Err()
	if err != nil {
		log.Printf("Failed to enqueue V2 automation job %s: %v", executionID, err)
		s.db.Exec("UPDATE automation_executions SET status = 'failed', error = $1 WHERE id = $2", "failed to enqueue", executionID)
	}

	log.Printf("V2 Automation %s primed and enqueued for content %s -> %s", executionID, normalized.ContentID, targetPlatform)
}

// BlastVideos initiates a one-off distribution of multiple past videos
func (s *AutomationService) BlastVideos(userID int, sourceAccountID int, videoIDs []string, targets []RuleTarget) (int, error) {
	// 1. Create a "Manual" rule to link these jobs (unique for each blast)
	var ruleID int
	name := fmt.Sprintf("Quick Blast - %s", time.Now().Format("Jan 02, 15:04"))

	targetsJSON, _ := json.Marshal(targets)

	err := s.db.QueryRow(`
		INSERT INTO automation_rules (user_id, name, source_account_id, trigger_type, filters, targets, is_active)
		VALUES ($1, $2, $3, 'manual', '{}', $4, false)
		RETURNING id
	`, userID, name, sourceAccountID, targetsJSON).Scan(&ruleID)

	if err != nil {
		return 0, fmt.Errorf("failed to create blast rule: %w", err)
	}

	// 2. Enqueue jobs for each video and each target
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

		for _, target := range targets {
			s.createAutomationJob(ruleID, videoID, target.AccountID, title)
		}
	}

	return ruleID, nil
}
func (s *AutomationService) RetryExecution(ctx context.Context, executionID string) error {
	// 1. Fetch details for re-queueing
	var contentID, targetPlatform string
	var targetAccountID int
	err := s.db.QueryRow(`
		SELECT content_id, target_platform, target_account_id
		FROM automation_executions WHERE id = $1
	`, executionID).Scan(&contentID, &targetPlatform, &targetAccountID)

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
