package app

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"time"

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

func RunWorker(ctx context.Context, db *sql.DB, throttle *services.ThrottleService, whatsappSvc *services.WhatsAppService) error {
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
		workers.NewUploadWorker(db, queueService, storageService, throttle, mediaService, whatsappSvc),
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
