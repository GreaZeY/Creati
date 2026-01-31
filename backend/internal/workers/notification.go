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

type NotificationJob struct {
	UserID  int    `json:"user_id"`
	Type    string `json:"type"`
	Message string `json:"message"`
}

type NotificationWorker struct {
	BaseWorker
	DB *sql.DB
}

func NewNotificationWorker(db *sql.DB, queueSvc *services.QueueService) *NotificationWorker {
	return &NotificationWorker{
		BaseWorker: BaseWorker{QueueSvc: queueSvc},
		DB:         db,
	}
}

func (w *NotificationWorker) Name() string  { return "NotificationWorker" }
func (w *NotificationWorker) Queue() string { return services.QueueNotification }

func (w *NotificationWorker) Process(ctx context.Context, payload []byte) error {
	var job NotificationJob
	if err := json.Unmarshal(payload, &job); err != nil {
		return fmt.Errorf("failed to unmarshal notification job: %w", err)
	}

	logger.Get("worker").WithFields(logrus.Fields{
		"user_id": job.UserID,
		"type":    job.Type,
	}).Info("Sending notification...")

	// 1. Persist Notification to DB
	_, err := w.DB.ExecContext(ctx, `
		INSERT INTO notifications (user_id, type, message)
		VALUES ($1, $2, $3)
	`, job.UserID, job.Type, job.Message)

	if err != nil {
		return fmt.Errorf("failed to save notification: %w", err)
	}

	// 2. Future: Real-time SSE / Push notification logic
	// ...

	return nil
}
