package workers

import (
	"context"
	"database/sql"
	"log"
	"time"
)

type Scheduler struct {
	db       *sql.DB
	interval time.Duration
}

func NewScheduler(db *sql.DB, interval time.Duration) *Scheduler {
	return &Scheduler{
		db:       db,
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
	// Transition scheduled jobs to pending when their time has arrived
	// The existing automation workers will pick them up from there
	result, err := s.db.ExecContext(ctx, `
		UPDATE automation_jobs
		SET scheduled_status = 'executing',
		    status = 'pending'
		WHERE scheduled_status = 'scheduled'
		AND scheduled_at <= NOW()
	`)
	
	if err != nil {
		log.Printf("[Scheduler] Error processing scheduled jobs: %v", err)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected > 0 {
		log.Printf("[Scheduler] Triggered %d scheduled jobs", rowsAffected)
	}
}
