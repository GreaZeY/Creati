package workers

import (
	"context"

	"creati.in/creati/backend/internal/services"
)

// Job represents a generic task in the pipeline
type Job struct {
	Queue   string      `json:"queue"`
	Payload interface{} `json:"payload"`
}

// Worker interface for all pipeline stages
type Worker interface {
	Name() string
	Queue() string
	Process(ctx context.Context, payload []byte) error
}

// Task is the serialized job data from Redis
type Task struct {
	Payload []byte
}

type BaseWorker struct {
	QueueSvc *services.QueueService
}

func (b *BaseWorker) Requeue(ctx context.Context, queue string, payload []byte) error {
	return b.QueueSvc.Client.LPush(ctx, queue, payload).Err()
}

func (b *BaseWorker) SendToDLQ(ctx context.Context, dlq string, payload []byte, err error) error {
	// Wrap with error info later if needed
	return b.QueueSvc.Client.LPush(ctx, dlq, payload).Err()
}
