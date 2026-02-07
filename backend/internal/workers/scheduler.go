package workers

import (
	"context"
	"database/sql"
	"log"
	"time"

	"creati.in/creati/backend/internal/services"
)

type Scheduler struct {
	db           *sql.DB
	queueService *services.QueueService
	interval     time.Duration
}

func NewScheduler(db *sql.DB, queueService *services.QueueService, interval time.Duration) *Scheduler {
	return &Scheduler{
		db:           db,
		queueService: queueService,
		interval:     interval,
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
	// Find jobs that are due
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, trace_id, job_data
		FROM automation_jobs
		WHERE scheduled_status = 'scheduled'
		AND scheduled_at <= NOW()
		ORDER BY scheduled_at ASC
		LIMIT 50
	`)
	if err != nil {
		log.Printf("[Scheduler] Error querying scheduled jobs: %v", err)
		return
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var jobID int
		var traceID string
		var jobData []byte

		if err := rows.Scan(&jobID, &traceID, &jobData); err != nil {
			log.Printf("[Scheduler] Error scanning job: %v", err)
			continue
		}

		// Transition to executing (with lock to prevent duplicate execution)
		result, err := s.db.ExecContext(ctx, `
			UPDATE automation_jobs
			SET scheduled_status = 'executing'
			WHERE id = $1 AND scheduled_status = 'scheduled'
		`, jobID)
		if err != nil {
			log.Printf("[Scheduler] Error updating job %d: %v", jobID, err)
			continue
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			// Another process already picked this up
			continue
		}

		// Queue the job for execution
		if s.queueService != nil {
			queueData := map[string]interface{}{
				"jobID":   jobID,
				"traceID": traceID,
				"data":    string(jobData),
			}
			if err := s.queueService.Enqueue("automation:execute", queueData); err != nil {
				log.Printf("[Scheduler] Error enqueueing job %d: %v", jobID, err)
			} else {
				count++
				log.Printf("[Scheduler] Triggered job %d (trace: %s)", jobID, traceID)
			}
		}
	}

	if count > 0 {
		log.Printf("[Scheduler] Processed %d scheduled jobs", count)
	}
}
