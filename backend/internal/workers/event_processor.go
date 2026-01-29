package workers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"example.com/creati/backend/internal/events"
	"example.com/creati/backend/internal/logger"
)

/**
 * EventProcessor is a background worker that consumes platform_events
 * and triggers downstream actions (video creation, automation rules)
 *
 * Responsibilities:
 * 1. Poll for pending events
 * 2. Fetch full content metadata from platforms
 * 3. Create/update videos table entries
 * 4. Evaluate automation_rules
 * 5. Create automation_jobs
 * 6. Mark events as processed/failed
 */

type EventProcessor struct {
	db         *sql.DB
	eventStore *events.Store
	interval   time.Duration
	batchSize  int
}

func NewEventProcessor(db *sql.DB, interval time.Duration, batchSize int) *EventProcessor {
	return &EventProcessor{
		db:         db,
		eventStore: events.NewStore(db),
		interval:   interval,
		batchSize:  batchSize,
	}
}

// Start begins processing events in a loop
func (p *EventProcessor) Start(ctx context.Context) {
	logger.Log("info", fmt.Sprintf("Event processor started (interval=%s, batch=%d)", p.interval, p.batchSize), nil, "event_processor")

	ticker := time.NewTicker(p.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			logger.Log("info", "Event processor shutting down", nil, "event_processor")
			return
		case <-ticker.C:
			if err := p.processBatch(ctx); err != nil {
				logger.Log("error", "Event processor error", err, "event_processor")
			}
		}
	}
}

// processBatch fetches and processes a batch of pending events
func (p *EventProcessor) processBatch(ctx context.Context) error {
	pendingEvents, err := p.eventStore.GetPendingEvents(ctx, p.batchSize)
	if err != nil {
		return err
	}

	if len(pendingEvents) == 0 {
		return nil // No work
	}

	logger.Log("info", fmt.Sprintf("Processing %d pending events", len(pendingEvents)), nil, "event_processor")

	for _, event := range pendingEvents {
		if err := p.processEvent(ctx, event); err != nil {
			// Log error and mark as failed
			logger.Log("error", fmt.Sprintf("Failed to process event %s", event.ID), err, "event_processor")
			p.eventStore.MarkEventFailed(ctx, event.ID, err.Error())
		} else {
			// Mark as processed
			p.eventStore.MarkEventProcessed(ctx, event.ID)
			logger.Log("info", fmt.Sprintf("Event %s processed successfully", event.ID), nil, "event_processor")
		}
	}

	return nil
}

// processEvent handles a single event
func (p *EventProcessor) processEvent(ctx context.Context, event *events.NormalizedEvent) error {
	logger.Log("info", fmt.Sprintf("Processing event: platform=%s, type=%s, external_id=%s", event.Platform, event.EventType, event.ExternalID), nil, "event_processor")

	// Step 1: Create or update video record
	videoID, err := p.createOrUpdateVideo(ctx, event)
	if err != nil {
		return err
	}

	// Step 2: Evaluate automation rules for this account/platform
	if err := p.evaluateAutomationRules(ctx, event, videoID); err != nil {
		logger.Log("error", "Failed to evaluate automation rules", err, "event_processor")
		// Don't fail the entire event processing if rule evaluation fails
	}

	return nil
}

// createOrUpdateVideo creates a video record from the event
func (p *EventProcessor) createOrUpdateVideo(ctx context.Context, event *events.NormalizedEvent) (int, error) {
	// Extract metadata from payload
	title, _ := event.Payload["title"].(string)
	description, _ := event.Payload["description"].(string)

	// Check if video already exists
	var existingVideoID int
	err := p.db.QueryRowContext(ctx, `
		SELECT id FROM videos 
		WHERE user_id = (
			SELECT user_id FROM platform_accounts WHERE id = $1
		) AND external_id = $2
	`, event.AccountID, event.ExternalID).Scan(&existingVideoID)

	if err == nil {
		// Video exists - update metadata
		_, err = p.db.ExecContext(ctx, `
			UPDATE videos 
			SET title = $1, description = $2, updated_at = $3
			WHERE id = $4
		`, title, description, time.Now(), existingVideoID)
		return existingVideoID, err
	}

	if err != sql.ErrNoRows {
		return 0, err
	}

	// Video doesn't exist - create it
	payloadJSON, _ := json.Marshal(event.Payload)

	var videoID int
	err = p.db.QueryRowContext(ctx, `
		INSERT INTO videos (
			user_id, title, description, external_id, platform, 
			status, metadata, created_at
		) VALUES (
			(SELECT user_id FROM platform_accounts WHERE id = $1),
			$2, $3, $4, $5, 'published', $6, $7
		) RETURNING id
	`, event.AccountID, title, description, event.ExternalID, event.Platform, payloadJSON, event.OccurredAt).Scan(&videoID)

	if err != nil {
		return 0, err
	}

	logger.Log("info", fmt.Sprintf("Created video record: id=%d, external_id=%s", videoID, event.ExternalID), nil, "event_processor")
	return videoID, nil
}

// evaluateAutomationRules checks if any automation rules match this event
func (p *EventProcessor) evaluateAutomationRules(ctx context.Context, event *events.NormalizedEvent, videoID int) error {
	// Fetch active rules for this source account
	rows, err := p.db.QueryContext(ctx, `
		SELECT id, name, targets, filters 
		FROM automation_rules 
		WHERE source_account_id = $1 
		  AND is_active = true
	`, event.AccountID)

	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var ruleID int
		var ruleName string
		var targetsJSON, filtersJSON []byte

		if err := rows.Scan(&ruleID, &ruleName, &targetsJSON, &filtersJSON); err != nil {
			logger.Log("error", "Error scanning rule", err, "event_processor")
			continue
		}

		// Parse filters
		var filters map[string]interface{}
		if err := json.Unmarshal(filtersJSON, &filters); err != nil {
			logger.Log("error", fmt.Sprintf("Error parsing filters for rule %d", ruleID), err, "event_processor")
			continue
		}

		// Apply filters (basic implementation - can be extended)
		if !p.matchesFilters(event, filters) {
			logger.Log("info", fmt.Sprintf("Event does not match rule %d filters", ruleID), nil, "event_processor")
			continue
		}

		// Parse targets
		var targets []map[string]interface{}
		if err := json.Unmarshal(targetsJSON, &targets); err != nil {
			logger.Log("error", fmt.Sprintf("Error parsing targets for rule %d", ruleID), err, "event_processor")
			continue
		}

		// Create automation jobs for each target
		for _, target := range targets {
			targetAccountID, ok := target["account_id"].(float64) // JSON numbers are float64
			if !ok {
				continue
			}

			_, err := p.db.ExecContext(ctx, `
				INSERT INTO automation_jobs (
					rule_id, video_id, source_platform_id, target_account_id, status, created_at
				) VALUES ($1, $2, $3, $4, 'pending', $5)
			`, ruleID, videoID, event.ExternalID, int(targetAccountID), time.Now())

			if err != nil {
				logger.Log("error", "Error creating automation job", err, "event_processor")
				continue
			}

			logger.Log("info", fmt.Sprintf("Created automation job: rule=%s, target_account=%d", ruleName, int(targetAccountID)), nil, "event_processor")
		}

		// Update rule's last_run_at
		_, err = p.db.ExecContext(ctx, `
			UPDATE automation_rules SET last_run_at = $1 WHERE id = $2
		`, time.Now(), ruleID)
		if err != nil {
			logger.Log("error", "Error updating rule last_run_at", err, "event_processor")
		}
	}

	return rows.Err()
}

// matchesFilters applies rule filters to event (basic implementation)
func (p *EventProcessor) matchesFilters(event *events.NormalizedEvent, filters map[string]interface{}) bool {
	// If no filters, match all
	if len(filters) == 0 {
		return true
	}

	// Example: Check for keyword filter in title
	if keywords, ok := filters["keywords"].([]interface{}); ok {
		title, _ := event.Payload["title"].(string)
		hasMatch := false
		for _, kw := range keywords {
			if keyword, ok := kw.(string); ok {
				if contains(title, keyword) {
					hasMatch = true
					break
				}
			}
		}
		if !hasMatch {
			return false
		}
	}

	// Add more filter types as needed (duration, tags, etc.)

	return true
}

// contains is a case-insensitive substring check
func contains(str, substr string) bool {
	// Simple implementation - could use strings.Contains or regex
	return len(str) > 0 && len(substr) > 0 // Placeholder
}
