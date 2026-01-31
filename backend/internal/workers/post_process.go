package workers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"creati.in/creati/backend/internal/logger"
	"creati.in/creati/backend/internal/services"
)

type PostProcessJob struct {
	ExecutionID     string `json:"execution_id"`
	PlatformVideoID string `json:"platform_video_id"`
}

type PostProcessWorker struct {
	BaseWorker
	DB *sql.DB
}

func NewPostProcessWorker(db *sql.DB, queueSvc *services.QueueService) *PostProcessWorker {
	return &PostProcessWorker{
		BaseWorker: BaseWorker{QueueSvc: queueSvc},
		DB:         db,
	}
}

func (w *PostProcessWorker) Name() string  { return "PostProcessWorker" }
func (w *PostProcessWorker) Queue() string { return services.QueuePostProcess }

func (w *PostProcessWorker) Process(ctx context.Context, payload []byte) error {
	var job PostProcessJob
	if err := json.Unmarshal(payload, &job); err != nil {
		return fmt.Errorf("failed to unmarshal post-process job: %w", err)
	}

	logger.Get("worker").WithField("execution_id", job.ExecutionID).Info("Finalizing execution...")

	// 1. Mark Execution as Completed
	_, err := w.DB.ExecContext(ctx, `
		UPDATE automation_executions 
		SET status = 'completed', completed_at = NOW() 
		WHERE id = $1
	`, job.ExecutionID)
	if err != nil {
		return fmt.Errorf("failed to update execution status: %w", err)
	}

	// 2. Fetch User for Notification
	var userID int
	var targetPlatform string
	err = w.DB.QueryRowContext(ctx, `
		SELECT rule.user_id, e.target_platform
		FROM automation_executions e
		JOIN automation_rules rule ON e.rule_id = rule.id
		WHERE e.id = $1
	`, job.ExecutionID).Scan(&userID, &targetPlatform)

	if err == nil {
		// 3. Enqueue Notification
		notifPayload, _ := json.Marshal(map[string]interface{}{
			"user_id": userID,
			"type":    "UPLOAD_SUCCESS",
			"message": fmt.Sprintf("Successfully distributed to %s!", targetPlatform),
		})
		w.QueueSvc.Client.LPush(ctx, services.QueueNotification, notifPayload)
	}

	return nil
}
