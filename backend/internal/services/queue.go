package services

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"creati.in/creati/backend/internal/logger"
	"github.com/redis/go-redis/v9"
)

type QueueService struct {
	Client *redis.Client
}

type UploadJob struct {
	VideoID         int    `json:"video_id"`
	JobID           int    `json:"job_id"`
	AccountID       int    `json:"account_id"`
	Platform        string `json:"platform"`
	RetryCount      int    `json:"retry_count"`
	AutomationJobID int    `json:"automation_job_id,omitempty"`
	SourceVideoID   string `json:"source_video_id,omitempty"` // External ID if from automation
}

const (
	QueueIngestion     = "ingestion_queue"
	QueueOrchestration = "orchestration_queue"
	QueueUpload        = "upload_queue"
	QueuePostProcess   = "post_process_queue"
	QueueNotification  = "notification_queue"
	QueueUploadDLQ     = "upload_dlq"
	QueueNotifyDLQ     = "notify_dlq"
)

func NewQueueService() (*QueueService, error) {
	redisURL := os.Getenv("REDIS_QUEUE_URL")
	if redisURL == "" {
		// Fallback for dev if not specified
		redisURL = "localhost:6380"
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		opt = &redis.Options{
			Addr: redisURL,
		}
	}

	client := redis.NewClient(opt)

	// Test connection
	if err := client.Ping(context.Background()).Err(); err != nil {
		logger.Get("queue").WithError(err).Warn("Redis Queue: Connection failed. Continuing in limited mode.")
		// Return client anyway, subsequent operations should handle errors
	}

	return &QueueService{
		Client: client,
	}, nil
}

func (q *QueueService) EnqueueUpload(ctx context.Context, job UploadJob) error {
	data, err := json.Marshal(job)
	if err != nil {
		return err
	}

	// Push to 'upload_queue'
	return q.Client.LPush(ctx, "upload_queue", data).Err()
}

// DequeueUpload waits for a job from the queue (blocking)
func (q *QueueService) DequeueUpload(ctx context.Context) (*UploadJob, error) {
	// BRPOP returns [key, value]
	results, err := q.Client.BRPop(ctx, 0, "upload_queue").Result()
	if err != nil {
		return nil, err
	}

	if len(results) < 2 {
		return nil, fmt.Errorf("invalid response from redis")
	}

	var job UploadJob
	if err := json.Unmarshal([]byte(results[1]), &job); err != nil {
		return nil, err
	}

	return &job, nil
}

// Dequeue waits for a job from a specific queue (blocking)
func (q *QueueService) Dequeue(ctx context.Context, queueName string) ([]byte, error) {
	results, err := q.Client.BRPop(ctx, 0, queueName).Result()
	if err != nil {
		return nil, err
	}
	if len(results) < 2 {
		return nil, fmt.Errorf("invalid response from redis")
	}
	return []byte(results[1]), nil
}

// GetQueueDepth returns the number of pending jobs in the queue
func (q *QueueService) GetQueueDepth(ctx context.Context, queueName string) (int64, error) {
	return q.Client.LLen(ctx, queueName).Result()
}
