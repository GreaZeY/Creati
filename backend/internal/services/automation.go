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
	// 1. Record in database
	var jobID int
	err := s.db.QueryRow(`
		INSERT INTO automation_jobs (rule_id, source_platform_id, target_account_id, status)
		VALUES ($1, $2, $3, 'pending')
		RETURNING id
	`, ruleID, sourceVideoID, targetAccountID).Scan(&jobID)

	if err != nil {
		log.Printf("Failed to create automation job record: %v", err)
		return
	}

	// 2. Fetch platform name for the target account
	var platform string
	err = s.db.QueryRow("SELECT platform FROM platform_accounts WHERE id = $1", targetAccountID).Scan(&platform)
	if err != nil {
		log.Printf("Failed to fetch target platform name: %v", err)
		s.db.Exec("UPDATE automation_jobs SET status = 'failed', error = $1 WHERE id = $2", "target platform not found", jobID)
		return
	}

	// 3. Queue for worker
	job := UploadJob{
		AutomationJobID: jobID,
		SourceVideoID:   sourceVideoID,
		AccountID:       targetAccountID,
		Platform:        platform,
	}

	if err := s.queue.EnqueueUpload(context.Background(), job); err != nil {
		log.Printf("Failed to enqueue automation job: %v", err)
		s.db.Exec("UPDATE automation_jobs SET status = 'failed', error = $1 WHERE id = $2", "failed to enqueue job", jobID)
		return
	}

	log.Printf("Automation Job %d enqueued for rule %d -> target %d (%s)", jobID, ruleID, targetAccountID, platform)
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
		// Fetch title from source if possible (optional, worker handles it)
		for _, target := range targets {
			s.createAutomationJob(ruleID, videoID, target.AccountID, "Archive Blast Video")
		}
	}

	return ruleID, nil
}
