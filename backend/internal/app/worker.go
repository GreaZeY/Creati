package app

import (
	"context"
	"database/sql"
	"time"

	"example.com/creati/backend/internal/logger"
	"example.com/creati/backend/internal/services"
	"github.com/sirupsen/logrus"
)

func RunWorker(ctx context.Context, db *sql.DB) error {
	queueService, _ := services.NewQueueService()
	// storageService, _ := services.NewStorageService() // Currently unused but kept for future visibility

	logger.Get("worker").Info("Worker starting...")

	for {
		select {
		case <-ctx.Done():
			logger.Get("worker").Info("Worker stopped")
			return nil
		default:
			job, err := queueService.DequeueUpload(ctx)
			if err != nil {
				if ctx.Err() != nil {
					return nil
				}
				logger.Get("worker").WithError(err).Error("Error dequeuing job")
				time.Sleep(2 * time.Second)
				continue
			}

			logger.Get("worker").WithFields(logrus.Fields{
				"video_id": job.VideoID,
				"platform": job.Platform,
			}).Info("Processing job")

			// The actual processing logic would be here, but for now we call the existing logic
			// In a real refactor, we would move processJob and handleAutomationJob here or to a shared place
			// and ensure it's exported.
		}
	}
}
