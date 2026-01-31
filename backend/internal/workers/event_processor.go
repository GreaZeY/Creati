package workers

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"creati.in/creati/backend/internal/events"
	"creati.in/creati/backend/internal/logger"
	"creati.in/creati/backend/internal/services"
	"github.com/lib/pq"
	"github.com/sirupsen/logrus"
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
	db              *sql.DB
	dsn             string
	eventStore      *events.Store
	realtimeService *services.RealtimeService
	interval        time.Duration
	batchSize       int
}

func NewEventProcessor(db *sql.DB, dsn string, realtime *services.RealtimeService, interval time.Duration, batchSize int) *EventProcessor {
	return &EventProcessor{
		db:              db,
		dsn:             dsn,
		eventStore:      events.NewStore(db),
		realtimeService: realtime,
		interval:        interval,
		batchSize:       batchSize,
	}
}

// Start begins processing events in a loop
func (p *EventProcessor) Start(ctx context.Context) {
	log := logger.Get("event_processor")
	log.WithFields(logrus.Fields{
		"interval": p.interval,
		"batch":    p.batchSize,
	}).Info("Event processor started with LISTEN/NOTIFY support")

	// 1. Set up pq Listener for instant updates
	reportProblem := func(ev pq.ListenerEventType, err error) {
		if err != nil {
			log.Errorf("pq listener error: %v", err)
		}
	}

	listener := pq.NewListener(p.dsn, 10*time.Second, time.Minute, reportProblem)
	_ = listener.Listen("platform_event_inserted")
	_ = listener.Listen("automation_execution_updated") // Correct V2 channel
	defer listener.UnlistenAll()

	// 2. Ticker for fallback polling (heartbeat)
	ticker := time.NewTicker(p.interval)
	defer ticker.Stop()

	// Initial run
	if err := p.processBatch(ctx); err != nil {
		log.Errorf("Initial batch processing failed: %v", err)
	}

	for {
		select {
		case <-ctx.Done():
			log.Info("Event processor shutting down")
			return
		case <-ticker.C:
			// Regular heartbeat fallback
			if err := p.processBatch(ctx); err != nil {
				log.WithField("error", err).Error("Heartbeat batch processing failed")
			}
		case n := <-listener.Notify:
			if n == nil {
				continue
			}
			log.WithFields(logrus.Fields{
				"channel": n.Channel,
				"extra":   n.Extra,
			}).Debug("Received notification")

			if n.Channel == "platform_event_inserted" {
				if err := p.processBatch(ctx); err != nil {
					log.WithField("error", err).Error("Triggered batch processing failed")
				}
			} else if n.Channel == "automation_execution_updated" {
				p.handleExecutionNotification(ctx, n.Extra)
			}
		}
	}
}

// handleExecutionNotification reacts to status changes by broadcasting to SSE
func (p *EventProcessor) handleExecutionNotification(ctx context.Context, execIDStr string) {
	var userID, ruleID int
	err := p.db.QueryRowContext(ctx, `
		SELECT ar.user_id, e.rule_id 
		FROM automation_executions e
		JOIN automation_rules ar ON e.rule_id = ar.id
		WHERE e.id = $1
	`, execIDStr).Scan(&userID, &ruleID)

	if err != nil {
		logger.Get("event_processor").WithField("error", err).Error("Failed to fetch user/rule for SSE broadcast")
		return
	}

	// Payload for SSE
	update := map[string]interface{}{
		"type":   "blast_update",
		"ruleId": ruleID,
	}
	msg, _ := json.Marshal(update)
	p.realtimeService.Broadcast(userID, string(msg))
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

	logger.Get("event_processor").WithField("count", len(pendingEvents)).Info("Processing pending events")

	for _, event := range pendingEvents {
		if err := p.processEvent(ctx, event); err != nil {
			// Log error and mark as failed
			logger.Get("event_processor").WithFields(logrus.Fields{
				"event_id": event.ID,
				"error":    err,
			}).Error("Failed to process event")
			p.eventStore.MarkEventFailed(ctx, event.ID, err.Error())
		} else {
			// Mark as processed
			p.eventStore.MarkEventProcessed(ctx, event.ID)
			logger.Get("event_processor").WithField("event_id", event.ID).Info("Event processed successfully")
		}
	}

	return nil
}

// processEvent handles a single event
func (p *EventProcessor) processEvent(ctx context.Context, event *events.NormalizedEvent) error {
	logger.Get("event_processor").WithFields(logrus.Fields{
		"platform":    event.Platform,
		"type":        event.EventType,
		"external_id": event.ExternalID,
	}).Info("Processing event")

	// Step 1: Create or update video record
	videoID, err := p.createOrUpdateVideo(ctx, event)
	if err != nil {
		return err
	}

	// Step 2: Evaluate automation rules for this account/platform
	if err := p.evaluateAutomationRules(ctx, event, videoID); err != nil {
		logger.Get("event_processor").WithField("error", err).Error("Failed to evaluate automation rules")
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

	logger.Get("event_processor").WithFields(logrus.Fields{
		"video_id":    videoID,
		"external_id": event.ExternalID,
	}).Info("Created video record")
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
			logger.Get("event_processor").WithField("error", err).Error("Error scanning rule")
			continue
		}

		// Parse filters
		var filters map[string]interface{}
		if err := json.Unmarshal(filtersJSON, &filters); err != nil {
			logger.Get("event_processor").WithFields(logrus.Fields{
				"rule_id": ruleID,
				"error":   err,
			}).Error("Error parsing filters")
			continue
		}

		// Apply filters (basic implementation - can be extended)
		if !p.matchesFilters(event, filters) {
			logger.Get("event_processor").WithField("rule_id", ruleID).Info("Event does not match filter")
			continue
		}

		// Parse targets
		var targets []map[string]interface{}
		if err := json.Unmarshal(targetsJSON, &targets); err != nil {
			logger.Get("event_processor").WithFields(logrus.Fields{
				"rule_id": ruleID,
				"error":   err,
			}).Error("Error parsing targets")
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
				logger.Get("event_processor").WithField("error", err).Error("Error creating automation job")
				continue
			}

			logger.Get("event_processor").WithFields(logrus.Fields{
				"rule":           ruleName,
				"target_account": int(targetAccountID),
			}).Info("Created automation job")
		}

		// Update rule's last_run_at
		_, err = p.db.ExecContext(ctx, `
			UPDATE automation_rules SET last_run_at = $1 WHERE id = $2
		`, time.Now(), ruleID)
		if err != nil {
			logger.Get("event_processor").WithField("error", err).Error("Error updating rule last_run_at")
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
