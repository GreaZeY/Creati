package workers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"time"

	"creati.in/creati/backend/internal/db/models"
	"creati.in/creati/backend/internal/logger"
	"creati.in/creati/backend/internal/services"
	"creati.in/creati/backend/internal/utils"
	"github.com/sirupsen/logrus"
)

type UploadJob struct {
	ContentID      string    `json:"content_id"`
	TargetPlatform string    `json:"target_platform"`
	AccountID      int       `json:"account_id"`
	ExecutionID    string    `json:"execution_id"`
	EnqueuedAt     time.Time `json:"enqueued_at"`
}

const (
	// JobTTL defines how long a job can sit in the queue before being discarded
	JobTTL = 24 * time.Hour
)

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

	// 0. TTL Check - Discard stale jobs
	if !job.EnqueuedAt.IsZero() {
		age := time.Since(job.EnqueuedAt)
		if age > JobTTL {
			logger.Get("worker").WithFields(logrus.Fields{
				"execution_id": job.ExecutionID,
				"age":          age.String(),
				"ttl":          JobTTL.String(),
			}).Warn("Job expired, discarding")
			w.DB.ExecContext(ctx, "UPDATE automation_executions SET status = 'failed', error = $1 WHERE id = $2",
				fmt.Sprintf("job expired (age: %s, ttl: %s)", age, JobTTL), job.ExecutionID)
			return nil // Return nil to ack and discard
		}
	}

	// 1. Validation
	if job.ExecutionID == "" || job.ContentID == "" {
		return fmt.Errorf("invalid job payload: missing ExecutionID or ContentID")
	}

	// 1. Update Execution Status
	w.DB.ExecContext(ctx, "UPDATE automation_executions SET status = 'processing' WHERE id = $1", job.ExecutionID)

	// Fetch Processing Settings
	var settingsJSON []byte
	var settings *utils.ProcessingSettings
	err := w.DB.QueryRowContext(ctx, "SELECT processing_settings FROM automation_executions WHERE id = $1", job.ExecutionID).Scan(&settingsJSON)
	if err == nil && len(settingsJSON) > 0 {
		_ = json.Unmarshal(settingsJSON, &settings)
		// Check if empty settings
		if settings != nil && settings.TrimStart == nil && settings.TrimEnd == nil && len(settings.Overlays) == 0 {
			settings = nil
		}
	}

	// 2. Fetch Content Details
	var originPlatform, originID, title, description string
	err = w.DB.QueryRowContext(ctx, `
		SELECT origin_platform, origin_platform_content_id, title, description 
		FROM contents WHERE id = $1
	`, job.ContentID).Scan(&originPlatform, &originID, &title, &description)
	if err != nil {
		// Handle cases where title/description might be empty or content not found gracefully
		if err == sql.ErrNoRows {
			logger.Get("worker").WithField("content_id", job.ContentID).Warn("Content not found, proceeding with empty title/description")
			title = ""
			description = ""
		} else {
			return w.fail(ctx, job, payload, fmt.Errorf("failed to fetch content: %w", err))
		}
	}

	// 3. Source Media Resolution
	var sourceS3URL sql.NullString
	err = w.DB.QueryRowContext(ctx, `
		SELECT s3_key FROM platform_contents 
		WHERE content_id = $1 AND platform = $2
	`, job.ContentID, originPlatform).Scan(&sourceS3URL)

	if err != nil && err != sql.ErrNoRows {
		return w.fail(ctx, job, payload, fmt.Errorf("failed to fetch platform content: %w", err))
	}

	finalS3URL := ""
	if sourceS3URL.Valid && sourceS3URL.String != "" {
		finalS3URL = sourceS3URL.String

		// If it's an external platform, we might need to download it to our storage first
		if originPlatform != "creati" || settings != nil {
			s3Key := fmt.Sprintf("automation/v2/source/%s.mp4", job.ContentID)

			// If we process, we use a different key to avoid overwriting source if desired,
			// BUT for simplicity in V1 we might just use a different key if we actually CHANGE it.
			// However, downloadToStorage downloads to temp then uploads to s3Key.
			// If we edit, we want the FINAL s3Key to point to the edited version?
			// Video model uses finalS3URL.
			// If we edit, we should probably upload to a new key.
			if settings != nil {
				s3Key = fmt.Sprintf("automation/v2/processed/%s_%s.mp4", job.ContentID, job.ExecutionID)
			}

			exists, _ := w.Storage.Exists(ctx, s3Key)
			if !exists || settings != nil {
				err = w.downloadToStorage(ctx, originPlatform, originID, s3Key, title, settings)
				if err != nil {
					return w.fail(ctx, job, payload, err)
				}
			}
			finalS3URL = w.Storage.GetObjectURL(s3Key)
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
		S3URL:       finalS3URL,
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
	`, job.ContentID, job.TargetPlatform, platformVideoID, job.AccountID, finalS3URL)

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

func (w *UploadWorker) downloadToStorage(ctx context.Context, platform, vidID, s3Key, title string, settings *utils.ProcessingSettings) error {
	if platform == "creati" && settings == nil {
		// Already in S3 or local storage, no download needed
		return nil
	}

	// Dynamic platform resolution via factory
	platformSvc, err := services.GetPlatformService(platform, w.DB)
	if err != nil {
		return err
	}

	// Prepare temp file for raw download
	// Use slightly different naming to avoid conflicts
	rawTemp, err := os.CreateTemp("", fmt.Sprintf("v2-upload-raw-%s-*.mp4", platform))
	if err != nil {
		return err
	}
	rawTempPath := rawTemp.Name()
	rawTemp.Close() // Close handle, we'll reopen or let downloaders handle it

	// Ensure cleanup of raw file
	defer os.Remove(rawTempPath)

	// 1. Download (High Quality if available, else Standard)
	downloaded := false

	if hqDownloader, ok := platformSvc.(services.HighQualityDownloader); ok {
		logger.Get("worker").WithField("platform", platform).Info("Attempting High Quality Download")
		err := hqDownloader.DownloadHighQuality(ctx, vidID, rawTempPath)
		if err == nil {
			downloaded = true
		} else {
			logger.Get("worker").WithError(err).Warn("HQ download failed, falling back to standard stream")
		}
	}

	if !downloaded {
		stream, contentType, err := platformSvc.GetStream(ctx, vidID)
		if err != nil {
			return fmt.Errorf("failed to get stream from %s: %w", platform, err)
		}
		defer stream.Close()
		_ = contentType // We assume mp4 for now or stream content type

		f, err := os.OpenFile(rawTempPath, os.O_WRONLY|os.O_TRUNC, 0644)
		if err != nil {
			return err
		}
		defer f.Close()

		_, err = io.Copy(f, stream)
		if err != nil {
			return err
		}
	}

	// 2. Processing (Trim / Overlays)
	currentPath := rawTempPath

	// Track intermediate files to clean up
	intermediateFiles := []string{}
	defer func() {
		for _, p := range intermediateFiles {
			os.Remove(p)
		}
	}()

	if settings != nil {
		vp := utils.NewVideoProcessor()

		// Trim
		if settings.TrimStart != nil && settings.TrimEnd != nil {
			trimmedPath, err := vp.Trim(ctx, currentPath, *settings.TrimStart, *settings.TrimEnd)
			if err != nil {
				return fmt.Errorf("trim failed: %w", err)
			}
			intermediateFiles = append(intermediateFiles, trimmedPath)
			currentPath = trimmedPath
		}

		// Overlays
		if len(settings.Overlays) > 0 {
			overlaidPath, err := vp.ApplyOverlays(ctx, currentPath, settings.Overlays)
			if err != nil {
				return fmt.Errorf("overlay failed: %w", err)
			}
			intermediateFiles = append(intermediateFiles, overlaidPath)
			currentPath = overlaidPath
		}
	}

	// 3. Upload to S3
	uploadFile, err := os.Open(currentPath)
	if err != nil {
		return err
	}
	defer uploadFile.Close()

	// Reset seek just in case
	uploadFile.Seek(0, 0)

	return w.Storage.Upload(ctx, s3Key, uploadFile, "video/mp4")
}
