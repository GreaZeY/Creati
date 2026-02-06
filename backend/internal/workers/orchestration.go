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
	TraceID        string `json:"trace_id"`
}

type OrchestrationWorker struct {
	BaseWorker
	DB          *sql.DB
	AudienceSvc *services.AudienceService
}

func NewOrchestrationWorker(db *sql.DB, queueSvc *services.QueueService, audienceSvc *services.AudienceService) *OrchestrationWorker {
	return &OrchestrationWorker{
		BaseWorker:  BaseWorker{QueueSvc: queueSvc},
		DB:          db,
		AudienceSvc: audienceSvc,
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

	// 0. Trigger Audience Notifications (Fire-and-forget)
	// We need UserID. We can query it or derive it.
	// Optimization: EnqueueFromContent could probably look up UserID from ContentID if not passed,
	// but let's see if we have it. The job only has ContentID.
	// We'll trust AudienceService to handle the lookup or update EnqueueFromContent to fetch UserID if needed.
	// Actually, EnqueueFromContent(ctx, contentID, sourcePlatform, userID) requires userID.
	// We need to fetch the UserID associated with this content.
	var userID int
	err := w.DB.QueryRowContext(ctx, "SELECT user_id FROM videos WHERE id = $1", job.ContentID).Scan(&userID)
	if err == nil {
		if err := w.AudienceSvc.EnqueueFromContent(ctx, job.ContentID, job.SourcePlatform, userID); err != nil {
			logger.Get("worker").WithError(err).Error("Failed to enqueue audience notifications")
		}
	} else {
		logger.Get("worker").WithError(err).Warn("Failed to fetch user_id for audience notification")
	}

	// 1. Fetch active rules for this source platform
	rows, err := w.DB.QueryContext(ctx, `
		SELECT r.id, r.user_id, r.targets, r.action
		FROM automation_rules r
		JOIN platform_accounts pa ON r.source_account_id = pa.id
		WHERE pa.platform = $1 AND r.is_active = true
	`, job.SourcePlatform)
	if err != nil {
		return fmt.Errorf("failed to fetch rules: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var ruleID int
		var userID int
		var targetsJSON []byte
		var action string
		if err := rows.Scan(&ruleID, &userID, &targetsJSON, &action); err != nil {
			continue
		}

		// Only process 'sync' or empty action (default sync) for upload orchestration
		if action != "" && action != "sync" {
			continue
		}

		var targets []struct {
			AccountID int    `json:"accountId"`
			Platform  string `json:"platform"`
		}
		json.Unmarshal(targetsJSON, &targets)

		for _, target := range targets {
			targetPlatform := target.Platform
			targetAccountID := target.AccountID

			if targetPlatform == "" {
				// Fallback to fetch platform from account ID if missing in JSON
				w.DB.QueryRowContext(ctx, "SELECT platform FROM platform_accounts WHERE id = $1", targetAccountID).Scan(&targetPlatform)
			}

			// 2. Insert execution (Cycle Detection via UNIQUE constraint)
			var executionID string
			err = w.DB.QueryRowContext(ctx, `
				INSERT INTO automation_executions 
				(content_id, rule_id, source_platform, target_platform, target_account_id, status, trace_id)
				VALUES ($1, $2, $3, $4, 'queued', NULLIF($5, ''))
				ON CONFLICT (content_id, target_platform) DO NOTHING
				RETURNING id
			`, job.ContentID, ruleID, job.SourcePlatform, targetPlatform, targetAccountID, job.TraceID).Scan(&executionID)

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
	}

	return nil
}
