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
		fmt.Printf("  ⚠️  Redis Queue: Connection failed (%v). Continuing in limited mode.\n", err)
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
