package workers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"creati.in/creati/backend/internal/logger"
	"creati.in/creati/backend/internal/services"
	"github.com/sirupsen/logrus"
)

type OrchestrationJob struct {
	ContentID      string `json:"content_id"`
	SourcePlatform string `json:"source_platform"`
}

type OrchestrationWorker struct {
	BaseWorker
	DB *sql.DB
}

func NewOrchestrationWorker(db *sql.DB, queueSvc *services.QueueService) *OrchestrationWorker {
	return &OrchestrationWorker{
		BaseWorker: BaseWorker{QueueSvc: queueSvc},
		DB:         db,
	}
}

func (w *OrchestrationWorker) Name() string  { return "OrchestrationWorker" }
func (w *OrchestrationWorker) Queue() string { return services.QueueOrchestration }

func (w *OrchestrationWorker) Process(ctx context.Context, payload []byte) error {
	var job OrchestrationJob
	if err := json.Unmarshal(payload, &job); err != nil {
		return fmt.Errorf("failed to unmarshal orchestration job: %w", err)
	}

	logger.Get("worker").WithFields(logrus.Fields{
		"content_id":      job.ContentID,
		"source_platform": job.SourcePlatform,
	}).Info("Orchestrating distribution...")

	// 1. Fetch active rules for this source platform
	rows, err := w.DB.QueryContext(ctx, `
		SELECT r.id, r.user_id, r.target_platform, r.target_account_id
		FROM automation_rules r
		JOIN platform_accounts pa ON r.source_account_id = pa.id
		WHERE pa.platform = $1 AND r.enabled = true
	`, job.SourcePlatform)
	if err != nil {
		return fmt.Errorf("failed to fetch rules: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var ruleID int
		var userID int
		var targetPlatform string
		var targetAccountID int
		if err := rows.Scan(&ruleID, &userID, &targetPlatform, &targetAccountID); err != nil {
			continue
		}

		// 2. Insert execution (Cycle Detection via UNIQUE constraint)
		var executionID string
		err = w.DB.QueryRowContext(ctx, `
			INSERT INTO automation_executions 
			(content_id, rule_id, source_platform, target_platform, target_account_id, status, trace_id)
			VALUES ($1, $2, $3, $4, $5, 'queued', gen_random_uuid())
			ON CONFLICT (content_id, target_platform) DO NOTHING
			RETURNING id
		`, job.ContentID, ruleID, job.SourcePlatform, targetPlatform, targetAccountID).Scan(&executionID)

		if err != nil {
			if err == sql.ErrNoRows {
				// Cycle detected or already processed
				logger.Get("worker").WithFields(logrus.Fields{
					"content_id": job.ContentID,
					"target":     targetPlatform,
				}).Debug("Skipping: Content already distributed to target")
				continue
			}
			logger.Get("worker").WithError(err).Error("Failed to create execution record")
			continue
		}

		// 3. Enqueue Upload Job
		uploadPayload, _ := json.Marshal(map[string]interface{}{
			"content_id":      job.ContentID,
			"target_platform": targetPlatform,
			"account_id":      targetAccountID,
			"execution_id":    executionID,
			"enqueued_at":     time.Now(),
		})

		err = w.QueueSvc.Client.LPush(ctx, services.QueueUpload, uploadPayload).Err()
		if err != nil {
			logger.Get("worker").WithError(err).Error("Failed to enqueue upload job")
		}
	}

	return nil
}
