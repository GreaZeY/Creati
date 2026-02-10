package workers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"creati.in/creati/backend/internal/logger"
	"creati.in/creati/backend/internal/services"
	"github.com/sirupsen/logrus"
)

type IngestionJob struct {
	Platform          string                 `json:"platform"`
	PlatformContentID string                 `json:"platform_content_id"`
	AccountID         int                    `json:"account_id"`
	Title             string                 `json:"title"`
	Description       string                 `json:"description"`
	Duration          int                    `json:"duration"`
	Metadata          map[string]interface{} `json:"metadata"`
}

type IngestionWorker struct {
	BaseWorker
	DB         *sql.DB
	Normalizer *services.ContentNormalizer
}

func NewIngestionWorker(db *sql.DB, queueSvc *services.QueueService) *IngestionWorker {
	return &IngestionWorker{
		BaseWorker: BaseWorker{QueueSvc: queueSvc},
		DB:         db,
		Normalizer: services.NewContentNormalizer(db),
	}
}

func (w *IngestionWorker) Name() string  { return "IngestionWorker" }
func (w *IngestionWorker) Queue() string { return services.QueueIngestion }

func (w *IngestionWorker) Process(ctx context.Context, payload []byte) error {
	var job IngestionJob
	if err := json.Unmarshal(payload, &job); err != nil {
		return fmt.Errorf("failed to unmarshal ingestion job: %w", err)
	}

	logger.Get("worker").WithFields(logrus.Fields{
		"platform": job.Platform,
		"id":       job.PlatformContentID,
	}).Info("Ingesting content...")

	// 1. Normalize Content
	normalized, err := w.Normalizer.NormalizeContent(
		ctx,
		job.Platform,
		job.PlatformContentID,
		job.Title,
		job.Description,
		job.Duration,
		"", // s3Key not available yet for ingestion
	)
	if err != nil {
		return fmt.Errorf("normalization failed: %w", err)
	}

	logger.Get("worker").WithFields(logrus.Fields{
		"content_id": normalized.ContentID,
		"is_new":     normalized.IsNew,
	}).Info("Content normalized")

	// 2. Enqueue Orchestration
	orchestrationPayload, _ := json.Marshal(map[string]interface{}{
		"content_id":      normalized.ContentID,
		"source_platform": job.Platform,
	})

	return w.QueueSvc.Client.LPush(ctx, services.QueueOrchestration, orchestrationPayload).Err()
}
