package services

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/redis/go-redis/v9"
)

type QueueService struct {
	Client *redis.Client
}

type UploadJob struct {
	VideoID    int    `json:"video_id"`
	JobID      int    `json:"job_id"`
	Platform   string `json:"platform"`
	RetryCount int    `json:"retry_count"`
}

func NewQueueService() (*QueueService, error) {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "localhost:6379"
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		// Fallback for simple host:port if not a URL
		opt = &redis.Options{
			Addr: redisURL,
		}
	}

	client := redis.NewClient(opt)

	// Test connection
	if err := client.Ping(context.Background()).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to redis: %w", err)
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
