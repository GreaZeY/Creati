package workers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"sort"
	"time"

	"creati.in/creati/backend/internal/db/models"
	"creati.in/creati/backend/internal/logger"
	"creati.in/creati/backend/internal/services"
	"github.com/kkdai/youtube/v2"
	"github.com/sirupsen/logrus"
)

type UploadJob struct {
	ContentID      string `json:"content_id"`
	TargetPlatform string `json:"target_platform"`
	AccountID      int    `json:"account_id"`
	ExecutionID    string `json:"execution_id"`
}

type UploadWorker struct {
	BaseWorker
	DB       *sql.DB
	Storage  *services.StorageService
	Throttle *services.ThrottleService
}

func NewUploadWorker(db *sql.DB, queueSvc *services.QueueService, storage *services.StorageService, throttle *services.ThrottleService) *UploadWorker {
	return &UploadWorker{
		BaseWorker: BaseWorker{QueueSvc: queueSvc},
		DB:         db,
		Storage:    storage,
		Throttle:   throttle,
	}
}

func (w *UploadWorker) Name() string  { return "UploadWorker" }
func (w *UploadWorker) Queue() string { return services.QueueUpload }

func (w *UploadWorker) Process(ctx context.Context, payload []byte) error {
	var job UploadJob
	if err := json.Unmarshal(payload, &job); err != nil {
		return fmt.Errorf("failed to unmarshal upload job: %w", err)
	}

	logger.Get("worker").WithFields(logrus.Fields{
		"execution_id": job.ExecutionID,
		"platform":     job.TargetPlatform,
	}).Info("Processing upload...")

	// 0. Validation
	if job.ExecutionID == "" || job.ContentID == "" {
		return fmt.Errorf("invalid job payload: missing ExecutionID or ContentID")
	}

	// 1. Update Execution Status
	w.DB.ExecContext(ctx, "UPDATE automation_executions SET status = 'processing' WHERE id = $1", job.ExecutionID)

	// 2. Fetch Content Details
	var originPlatform, originID, title, description string
	err := w.DB.QueryRowContext(ctx, `
		SELECT origin_platform, origin_platform_content_id, title, description 
		FROM contents WHERE id = $1
	`, job.ContentID).Scan(&originPlatform, &originID, &title, &description)
	if err != nil {
		return w.fail(ctx, job, payload, fmt.Errorf("failed to fetch content: %w", err))
	}

	// 3. Platform Specific Download/Storage Logic (Example: YT to S3)
	// In the real system, this would be polymorphic. Simplified for now.
	s3Key := fmt.Sprintf("automation/v2/%s/%s.mp4", job.ContentID, job.TargetPlatform)
	s3URL := w.Storage.GetObjectURL(s3Key)

	exists, _ := w.Storage.Exists(ctx, s3Key)
	if !exists {
		// Download from source (YouTube example)
		err = w.downloadToStorage(ctx, originPlatform, originID, s3Key)
		if err != nil {
			return w.fail(ctx, job, payload, err)
		}
	}

	// 4. Rate Limiting via Throttle
	quotaKey := fmt.Sprintf("global:%s", job.TargetPlatform)
	if err := w.Throttle.Wait(ctx, quotaKey, 10, time.Hour); err != nil {
		return w.fail(ctx, job, payload, fmt.Errorf("throttle failed: %w", err))
	}

	// 5. Build Video Model for Platform Service
	v := &models.Video{
		Title:       title,
		Description: description,
		S3URL:       s3URL,
	}

	// Call Platform Service
	platformSvc, err := services.GetPlatformService(job.TargetPlatform, w.DB)
	if err != nil {
		return w.fail(ctx, job, payload, err)
	}

	platformVideoID, err := platformSvc.Upload(v, job.AccountID)
	if err != nil {
		return w.fail(ctx, job, payload, err)
	}

	// 6. Record Platform Content
	_, err = w.DB.ExecContext(ctx, `
		INSERT INTO platform_contents (content_id, platform, platform_content_id, account_id, s3_key)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (content_id, platform) DO NOTHING
	`, job.ContentID, job.TargetPlatform, platformVideoID, job.AccountID, s3URL)

	// 7. Enqueue Post Processing
	postPayload, _ := json.Marshal(map[string]interface{}{
		"execution_id":      job.ExecutionID,
		"platform_video_id": platformVideoID,
	})

	return w.QueueSvc.Client.LPush(ctx, services.QueuePostProcess, postPayload).Err()
}

func (w *UploadWorker) fail(ctx context.Context, job UploadJob, payload []byte, err error) error {
	logger.Get("worker").WithError(err).Error("Upload worker failed")

	// Update DB
	w.DB.ExecContext(ctx, "UPDATE automation_executions SET status = 'failed', error = $1 WHERE id = $2", err.Error(), job.ExecutionID)

	// Send to DLQ
	return w.SendToDLQ(ctx, services.QueueUploadDLQ, payload, err)
}

func (w *UploadWorker) downloadToStorage(ctx context.Context, platform, vidID, s3Key string) error {
	if platform == "creati" {
		// Already in S3 or local storage, no download needed
		return nil
	}

	if platform != "youtube" {
		return fmt.Errorf("source platform %s not supported for auto-download in V2 yet", platform)
	}

	client := youtube.Client{}
	video, err := client.GetVideoContext(ctx, vidID)
	if err != nil {
		return err
	}

	formats := video.Formats.WithAudioChannels()
	sort.Slice(formats, func(i, j int) bool { return formats[i].Height > formats[j].Height })
	if len(formats) == 0 {
		return fmt.Errorf("no formats found")
	}

	stream, _, err := client.GetStreamContext(ctx, video, &formats[0])
	if err != nil {
		return err
	}
	defer stream.Close()

	temp, err := os.CreateTemp("", "v2-upload-*.mp4")
	if err != nil {
		return err
	}
	defer os.Remove(temp.Name())
	defer temp.Close()

	_, err = io.Copy(temp, stream)
	if err != nil {
		return err
	}

	temp.Seek(0, 0)
	return w.Storage.Upload(ctx, s3Key, temp, "video/mp4")
}
