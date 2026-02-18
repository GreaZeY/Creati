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
	MediaSvc *services.MediaService
}

func NewUploadWorker(db *sql.DB, queueSvc *services.QueueService, storage *services.StorageService, throttle *services.ThrottleService, mediaSvc *services.MediaService) *UploadWorker {
	return &UploadWorker{
		BaseWorker: BaseWorker{QueueSvc: queueSvc},
		DB:         db,
		Storage:    storage,
		Throttle:   throttle,
		MediaSvc:   mediaSvc,
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

	// 1. Update Execution Status: downloading
	w.DB.ExecContext(ctx, "UPDATE automation_executions SET status = 'downloading' WHERE id = $1", job.ExecutionID)

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
	finalStorageURL := ""
	var sourceKey string

	// If it's an external platform, allow MediaService to handle caching/downloading
	if originPlatform != "creati" {
		var err error
		sourceKey, err = w.MediaSvc.EnsureCached(ctx, originPlatform, originID)
		if err != nil {
			return w.fail(ctx, job, payload, fmt.Errorf("failed to cache source media: %w", err))
		}
		finalStorageURL = w.Storage.GetObjectURL(sourceKey)
	} else {
		// Internal content
		var sourceStorageURL sql.NullString
		err = w.DB.QueryRowContext(ctx, `
			SELECT storage_key FROM platform_contents 
			WHERE content_id = $1 AND platform = 'creati'
		`, job.ContentID).Scan(&sourceStorageURL)

		if err != nil {
			if err == sql.ErrNoRows {
				return w.fail(ctx, job, payload, fmt.Errorf("content source not found"))
			}
			return w.fail(ctx, job, payload, err)
		}
		sourceKey = sourceStorageURL.String
		finalStorageURL = w.Storage.GetObjectURL(sourceKey)
	}

	// 4. Processing Phase
	if settings != nil {
		w.DB.ExecContext(ctx, "UPDATE automation_executions SET status = 'processing' WHERE id = $1", job.ExecutionID)
		// Download source to temp
		stream, err := w.Storage.GetStream(ctx, sourceKey)
		if err != nil {
			return w.fail(ctx, job, payload, fmt.Errorf("failed to get source stream: %w", err))
		}
		defer stream.Close()

		rawTemp, err := os.CreateTemp("", fmt.Sprintf("processing-source-%s-*.mp4", job.ContentID))
		if err != nil {
			return w.fail(ctx, job, payload, err)
		}
		defer os.Remove(rawTemp.Name())
		defer rawTemp.Close()

		if _, err := io.Copy(rawTemp, stream); err != nil {
			return w.fail(ctx, job, payload, fmt.Errorf("failed to download source for processing: %w", err))
		}

		// Proceed with processing
		// 2. Processing (Trim / Overlays)
		currentPath := rawTemp.Name()
		// Track intermediate files to clean up
		intermediateFiles := []string{}
		defer func() {
			for _, p := range intermediateFiles {
				os.Remove(p)
			}
		}()

		vp := utils.NewVideoProcessor()

		// Trim
		if settings.TrimStart != nil && settings.TrimEnd != nil {
			trimmedPath, err := vp.Trim(ctx, currentPath, *settings.TrimStart, *settings.TrimEnd)
			if err != nil {
				return w.fail(ctx, job, payload, fmt.Errorf("trim failed: %w", err))
			}
			intermediateFiles = append(intermediateFiles, trimmedPath)
			currentPath = trimmedPath
		}

		// Overlays
		if len(settings.Overlays) > 0 {
			overlaidPath, err := vp.ApplyOverlays(ctx, currentPath, settings.Overlays)
			if err != nil {
				return w.fail(ctx, job, payload, fmt.Errorf("overlay failed: %w", err))
			}
			intermediateFiles = append(intermediateFiles, overlaidPath)
			currentPath = overlaidPath
		}

		// Upload Processed Result
		processedKey := fmt.Sprintf("automation/v2/processed/%s_%s.mp4", job.ContentID, job.ExecutionID)
		uploadFile, err := os.Open(currentPath)
		if err != nil {
			return w.fail(ctx, job, payload, err)
		}
		defer uploadFile.Close()

		if err := w.Storage.Upload(ctx, processedKey, uploadFile, "video/mp4"); err != nil {
			return w.fail(ctx, job, payload, fmt.Errorf("failed to upload processed video: %w", err))
		}
		finalStorageURL = w.Storage.GetObjectURL(processedKey)
	}

	// 4. Rate Limiting via Throttle
	quotaKey := fmt.Sprintf("global:%s", job.TargetPlatform)
	if err := w.Throttle.Wait(ctx, quotaKey, 10, time.Hour); err != nil {
		return w.fail(ctx, job, payload, fmt.Errorf("throttle failed: %w", err))
	}

	// 5. Update Status: publishing
	w.DB.ExecContext(ctx, "UPDATE automation_executions SET status = 'publishing' WHERE id = $1", job.ExecutionID)

	// 6. Upload to Destination Platform
	logger.Get("worker").WithFields(logrus.Fields{
		"platform": job.TargetPlatform,
		"url":      finalStorageURL,
	}).Info("Starting platform upload")

	// Create a temporary Video object for the uploader
	// We might need to fetch the original video metadata if not present in job
	// But job has VideoID.

	// Fetch Video Metadata
	video := &models.Video{}
	// Use the 'title' and 'description' fetched earlier from 'contents' table
	video.Title = title
	video.Description = description

	// Override with payload title/desc if present (for blasts)
	// This part of the instruction seems to refer to a different 'payload' structure
	// or a different job type. For UploadJob, title/description are not directly in payload.
	// Keeping the original logic for now, assuming 'title' and 'description' are the final ones.

	video.StorageURL = finalStorageURL

	platformSvc, err := services.GetPlatformService(job.TargetPlatform, w.DB)
	if err != nil {
		return w.fail(ctx, job, payload, err)
	}

	platformVideoID, err := platformSvc.Upload(video, job.AccountID)
	if err != nil {
		return w.fail(ctx, job, payload, fmt.Errorf("platform upload failed: %w", err))
	}

	// 6. Update Job Status & Cleanup
	// If we created a processed file, we might want to delete it if it's ephemeral?
	// But for "blast", maybe we keep it?
	// Current logic keeps it.

	// If settings != nil, we created a processed file.
	// We might want to store specific metadata about it.

	// 6. Record Platform Content
	_, err = w.DB.ExecContext(ctx, `
		INSERT INTO platform_contents (content_id, platform, platform_content_id, account_id, storage_key)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (content_id, platform) DO NOTHING
	`, job.ContentID, job.TargetPlatform, platformVideoID, job.AccountID, finalStorageURL)

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
