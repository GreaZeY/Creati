package app

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"time"

	"creati.in/creati/backend/internal/db/models"
	"creati.in/creati/backend/internal/logger"
	"creati.in/creati/backend/internal/services"
	"creati.in/creati/backend/internal/workers"
	"github.com/sirupsen/logrus"
)

func getMaxRetries() int {
	val := os.Getenv("JOB_MAX_RETRIES")
	if val == "" {
		return 3 // Default
	}
	var retries int
	fmt.Sscanf(val, "%d", &retries)
	if retries == 0 && val != "0" {
		return 3
	}
	return retries
}

func RunWorker(ctx context.Context, db *sql.DB, throttle *services.ThrottleService) error {
	queueService, err := services.NewQueueService()
	if err != nil {
		return err
	}

	storageService, err := services.NewStorageService()
	if err != nil {
		return err
	}

	logger.Get("worker").Info("V2 Worker Pipeline starting...")

	// 1. Initial	// Audience Service
	audienceService := services.NewAudienceService(db, queueService)
	mediaService := services.NewMediaService(db, storageService)

	// 1. Define the worker pipeline stages (in order)
	pipeline := []workers.Worker{
		workers.NewIngestionWorker(db, queueService),
		workers.NewOrchestrationWorker(db, queueService, audienceService),
		workers.NewUploadWorker(db, queueService, storageService, throttle, mediaService),
		workers.NewPostProcessWorker(db, queueService),
		workers.NewNotificationWorker(db, queueService),
		workers.NewAudienceNotificationWorker(audienceService, db, queueService),
	}

	// 2. Start each worker stage in a goroutine
	for _, w := range pipeline {
		go startWorkerStage(ctx, w, queueService)
	}

	// 3. Keep old loop for legacy 'upload_queue' compatibility if necessary,
	// or just wait for context cancellation
	<-ctx.Done()
	logger.Get("worker").Info("V2 Worker Pipeline stopped")
	return nil
}

func startWorkerStage(ctx context.Context, w workers.Worker, q *services.QueueService) {
	logger.Get("worker").WithField("stage", w.Name()).WithField("queue", w.Queue()).Info("Stage started")

	for {
		select {
		case <-ctx.Done():
			return
		default:
			payload, err := q.Dequeue(ctx, w.Queue())
			if err != nil {
				if ctx.Err() == nil {
					logger.Get("worker").WithError(err).Errorf("Error dequeuing for %s", w.Name())
					time.Sleep(1 * time.Second)
				}
				continue
			}

			if err := w.Process(ctx, payload); err != nil {
				logger.Get("worker").WithFields(logrus.Fields{
					"stage": w.Name(),
					"error": err,
				}).Error("Job processing failed")
			}
		}
	}
}

// Keep HandleAutomationJob and ProcessJob for now to avoid reference errors if they are used elsewhere,
// though they should eventually be removed or redirected.

func ProcessJob(db *sql.DB, storage *services.StorageService, throttle *services.ThrottleService, job *services.UploadJob) error {
	// 0. Global Platform Rate Limiting
	// Define limits (could be per-platform, here generic for demo)
	// YouTube: 60 uploads per hour global, Instagram: 30 per hour global
	limit := 10             // fallback
	window := 1 * time.Hour // fallback
	quotaKey := fmt.Sprintf("global:%s", job.Platform)

	if job.Platform == "youtube" {
		limit = 60
	} else if job.Platform == "instagram" {
		limit = 30
	}

	logger.Get("worker").WithField("key", quotaKey).Debug("Checking quota...")
	if err := throttle.Wait(context.Background(), quotaKey, limit, window); err != nil {
		return fmt.Errorf("throttle wait failed: %w", err)
	}

	if job.AutomationJobID > 0 {
		return fmt.Errorf("legacy automation_jobs are discontinued. use automation_executions via orchestration worker")
	}

	// 1. Get Video details
	video := &models.Video{}
	err := db.QueryRow(`
		SELECT id, user_id, title, description, storage_url, status 
		FROM videos WHERE id = $1
	`, job.VideoID).Scan(&video.ID, &video.UserID, &video.Title, &video.Description, &video.StorageURL, &video.Status)

	if err != nil {
		return fmt.Errorf("failed to fetch video: %w", err)
	}

	// 2. Update job status to processing
	_, err = db.Exec("UPDATE video_platform_jobs SET status = $1, updated_at = NOW() WHERE id = $2", models.JobStatusProcessing, job.JobID)
	if err != nil {
		return fmt.Errorf("failed to update job status: %w", err)
	}

	// 3. Get Platform service via factory
	platformSvc, err := services.GetPlatformService(job.Platform, db)
	if err != nil {
		updateJobError(db, job.JobID, err.Error())
		return err
	}

	// 4. Perform Upload
	platformVideoID, err := platformSvc.Upload(video, job.AccountID)
	if err != nil {
		updateJobError(db, job.JobID, err.Error())
		return err
	}

	// 5. Update job status to completed and update main video record with external reference
	tx, err := db.Begin()
	if err != nil {
		return err
	}

	_, err = tx.Exec(`
		UPDATE video_platform_jobs 
		SET status = $1, platform_id = $2, updated_at = NOW() 
		WHERE id = $3
	`, models.JobStatusCompleted, platformVideoID, job.JobID)
	if err != nil {
		tx.Rollback()
		return err
	}

	// Also update the main video record with external reference for easier tracking
	_, err = tx.Exec(`
		UPDATE videos SET external_id = $1, platform = $2 WHERE id = $3 AND (external_id IS NULL OR external_id = '')
	`, platformVideoID, job.Platform, job.VideoID)
	if err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit()
}

func updateJobError(db *sql.DB, jobID int, errMsg string) {
	_, _ = db.Exec(`
		UPDATE video_platform_jobs 
		SET status = $1, error_msg = $2, updated_at = NOW() 
		WHERE id = $3
	`, models.JobStatusFailed, errMsg, jobID)
}
