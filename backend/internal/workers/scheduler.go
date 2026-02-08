package workers

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"time"

	"creati.in/creati/backend/internal/services"
)

type Scheduler struct {
	db       *sql.DB
	queue    *services.QueueService
	interval time.Duration
}

func NewScheduler(db *sql.DB, queue *services.QueueService, interval time.Duration) *Scheduler {
	return &Scheduler{
		db:       db,
		queue:    queue,
		interval: interval,
	}
}

// Start begins the scheduler polling loop
func (s *Scheduler) Start(ctx context.Context) {
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	log.Printf("[Scheduler] Started with interval %v", s.interval)

	for {
		select {
		case <-ctx.Done():
			log.Println("[Scheduler] Shutting down")
			return
		case <-ticker.C:
			s.processScheduledJobs(ctx)
		}
	}
}

func (s *Scheduler) processScheduledJobs(ctx context.Context) {
	// Transition scheduled jobs to queued when their time has arrived
	// We need to fetch them first to enqueue them in Redis
	rows, err := s.db.QueryContext(ctx, `
		UPDATE automation_executions
		SET scheduled_status = 'executing',
		    status = 'queued',
			updated_at = NOW()
		WHERE scheduled_status = 'scheduled'
		AND scheduled_at <= NOW()
		RETURNING id, content_id, target_platform, target_account_id
	`)
	
	if err != nil {
		log.Printf("[Scheduler] Error processing scheduled jobs: %v", err)
		return
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var id, contentID, platform string
		var accountID int
		if err := rows.Scan(&id, &contentID, &platform, &accountID); err != nil {
			log.Printf("[Scheduler] Error scanning scheduled job: %v", err)
			continue
		}

		// Enqueue to upload_queue
		if s.queue != nil {
			payload, _ := json.Marshal(map[string]interface{}{
				"content_id":      contentID,
				"target_platform": platform,
				"account_id":      accountID,
				"execution_id":    id,
				"enqueued_at":     time.Now(),
			})
			s.queue.Client.LPush(ctx, "upload_queue", payload)
		}
		count++
	}

	if count > 0 {
		log.Printf("[Scheduler] Triggered %d scheduled V2 jobs", count)
	}
}
