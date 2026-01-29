package app

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"math"
	"os"
	"time"

	"sort"

	"creati.in/creati/backend/internal/db/models"
	"creati.in/creati/backend/internal/logger"
	"creati.in/creati/backend/internal/services"
	"github.com/kkdai/youtube/v2"
	"github.com/sirupsen/logrus"
)

func getMaxRetries() int {
	val := os.Getenv("JOB_MAX_RETRIES")
	if val == "" {
		return 3 // Default
	}
	var retries int
	fmt.Sscanf(val, "%d", &retries)
	if retries == 0 && val != "0" {
		return 3
	}
	return retries
}

func RunWorker(ctx context.Context, db *sql.DB) error {
	queueService, err := services.NewQueueService()
	if err != nil {
		return err
	}

	storageService, err := services.NewStorageService()
	if err != nil {
		return err
	}

	logger.Get("worker").Info("Worker starting...")

	for {
		select {
		case <-ctx.Done():
			logger.Get("worker").Info("Worker stopped")
			return nil
		default:
			job, err := queueService.DequeueUpload(ctx)
			if err != nil {
				if ctx.Err() != nil {
					return nil
				}
				logger.Get("worker").WithError(err).Error("Error dequeuing job")
				time.Sleep(2 * time.Second)
				continue
			}

			logger.Get("worker").WithFields(logrus.Fields{
				"video_id": job.VideoID,
				"platform": job.Platform,
			}).Info("Processing job")

			err = ProcessJob(db, storageService, job)
			if err != nil {
				handleJobError(db, queueService, job, err)
			} else {
				logger.Get("worker").WithFields(logrus.Fields{
					"video_id": job.VideoID,
					"platform": job.Platform,
				}).Info("Job completed")
			}
		}
	}
}

func ProcessJob(db *sql.DB, storage *services.StorageService, job *services.UploadJob) error {
	if job.AutomationJobID > 0 {
		return HandleAutomationJob(db, storage, job)
	}

	// 1. Get Video details
	video := &models.Video{}
	err := db.QueryRow(`
		SELECT id, user_id, title, description, s3_url, status 
		FROM videos WHERE id = $1
	`, job.VideoID).Scan(&video.ID, &video.UserID, &video.Title, &video.Description, &video.S3URL, &video.Status)

	if err != nil {
		return fmt.Errorf("failed to fetch video: %w", err)
	}

	// 2. Update job status to processing
	_, err = db.Exec("UPDATE video_platform_jobs SET status = $1, updated_at = NOW() WHERE id = $2", models.JobStatusProcessing, job.JobID)
	if err != nil {
		return fmt.Errorf("failed to update job status: %w", err)
	}

	// 3. Get Platform service via factory
	platformSvc, err := services.GetPlatformService(job.Platform, db)
	if err != nil {
		updateJobError(db, job.JobID, err.Error())
		return err
	}

	// 4. Perform Upload
	platformVideoID, err := platformSvc.Upload(video, job.AccountID)
	if err != nil {
		updateJobError(db, job.JobID, err.Error())
		return err
	}

	// 5. Update job status to completed
	_, err = db.Exec(`
		UPDATE video_platform_jobs 
		SET status = $1, platform_id = $2, updated_at = NOW() 
		WHERE id = $3
	`, models.JobStatusCompleted, platformVideoID, job.JobID)

	return err
}

func HandleAutomationJob(db *sql.DB, storage *services.StorageService, job *services.UploadJob) error {
	logger.Get("automation").WithFields(logrus.Fields{
		"automation_job_id": job.AutomationJobID,
		"source_video_id":   job.SourceVideoID,
	}).Info("Processing Automation Job")

	// Update status
	_, err := db.Exec("UPDATE automation_jobs SET status = 'processing', updated_at = NOW() WHERE id = $1", job.AutomationJobID)
	if err != nil {
		return err
	}

	// 1. Get Target Details
	logger.Get("automation").Info("Fetching rule details...")
	var userID int
	var ruleName string
	err = db.QueryRow(`
		SELECT user_id, name FROM automation_rules WHERE id = (SELECT rule_id FROM automation_jobs WHERE id = $1)
	`, job.AutomationJobID).Scan(&userID, &ruleName)
	if err != nil {
		return fmt.Errorf("failed to fetch rule details: %w", err)
	}

	// 2. Download from YouTube to a temporary file
	logger.Get("automation").WithField("video_id", job.SourceVideoID).Info("Fetching YouTube metadata...")

	// Use a timeout for YouTube operations
	ytCtx, ytCancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer ytCancel()

	client := youtube.Client{}
	videoMetadata, err := client.GetVideoContext(ytCtx, job.SourceVideoID)
	if err != nil {
		return fmt.Errorf("failed to fetch youtube metadata: %w", err)
	}

	logger.Get("automation").WithField("title", videoMetadata.Title).Info("Got metadata, starting stream download...")

	formats := videoMetadata.Formats.WithAudioChannels()
	if len(formats) == 0 {
		return fmt.Errorf("no suitable video formats found")
	}

	// Sort formats by resolution (Height) descending to get best quality muxed stream
	sort.Slice(formats, func(i, j int) bool {
		return formats[i].Height > formats[j].Height
	})

	bestFormat := &formats[0]
	logger.Get("automation").WithFields(logrus.Fields{
		"resolution": fmt.Sprintf("%dx%d", bestFormat.Width, bestFormat.Height),
		"fps":        bestFormat.FPS,
	}).Info("Selected best quality muxed stream")

	stream, _, err := client.GetStreamContext(ytCtx, videoMetadata, bestFormat)
	if err != nil {
		return fmt.Errorf("failed to get youtube stream: %w", err)
	}
	defer stream.Close()

	tempFile, err := os.CreateTemp("", "creati-automation-*.mp4")
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}
	defer func() {
		tempFile.Close()
		os.Remove(tempFile.Name())
	}()

	logger.Get("automation").WithField("file", tempFile.Name()).Info("Downloading bytes to temp file...")

	// Create a progress reporter if needed, but for now just log completion
	bytesCopied, err := io.Copy(tempFile, stream)
	if err != nil {
		return fmt.Errorf("failed to download video to temp file: %w", err)
	}

	logger.Get("automation").WithField("bytes", bytesCopied).Info("Download complete. Rewinding file...")

	if _, err := tempFile.Seek(0, 0); err != nil {
		return fmt.Errorf("failed to rewind temp file: %w", err)
	}

	// 3. Stage in Storage
	s3Key := fmt.Sprintf("automation/%d/%d_%s.mp4", userID, job.AutomationJobID, job.SourceVideoID)
	logger.Get("automation").WithField("key", s3Key).Info("Uploading to storage...")

	uploadCtx, uploadCancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer uploadCancel()

	err = storage.Upload(uploadCtx, s3Key, tempFile, "video/mp4")
	if err != nil {
		return fmt.Errorf("failed to stage video in Storage: %w", err)
	}

	s3URL := storage.GetObjectURL(s3Key)
	logger.Get("automation").WithField("url", s3URL).Info("Upload successful!")

	// 4. Create transient Video model
	video := &models.Video{
		UserID:      userID,
		Title:       videoMetadata.Title,
		Description: fmt.Sprintf("Automatically synced from YouTube: %s\n\nRule: %s", videoMetadata.Description, ruleName),
		S3URL:       s3URL,
	}

	// 5. Proceed with normal Upload
	logger.Get("automation").WithField("platform", job.Platform).Info("Pushing to target platform...")
	platformSvc, err := services.GetPlatformService(job.Platform, db)
	if err != nil {
		return err
	}

	platformVideoID, err := platformSvc.Upload(video, job.AccountID)
	if err != nil {
		return err
	}

	logger.Get("automation").WithFields(logrus.Fields{
		"platform":          job.Platform,
		"platform_video_id": platformVideoID,
	}).Info("Automation redistributed")

	// 6. Final Status Update
	_, err = db.Exec(`
		UPDATE automation_jobs 
		SET status = 'completed', updated_at = NOW() 
		WHERE id = $1
	`, job.AutomationJobID)

	return err
}

func handleJobError(db *sql.DB, queue *services.QueueService, job *services.UploadJob, err error) {
	logger.Get("worker").WithField("error", err).Error("Job failed")

	maxRetries := getMaxRetries()
	if job.RetryCount < maxRetries {
		job.RetryCount++
		delay := time.Duration(math.Pow(4, float64(job.RetryCount))) * time.Second * 30
		logger.Get("worker").WithFields(logrus.Fields{
			"attempt":     job.RetryCount,
			"max_retries": maxRetries,
			"delay":       delay,
		}).Info("Retrying job")

		go func() {
			time.Sleep(delay)
			queue.EnqueueUpload(context.Background(), *job)
		}()
	} else {
		logger.Get("worker").WithField("job_id", job.JobID).Error("Max retries reached")
		if job.AutomationJobID > 0 {
			db.Exec("UPDATE automation_jobs SET status = 'failed', error = $1 WHERE id = $2", err.Error(), job.AutomationJobID)
		}
	}
}

func updateJobError(db *sql.DB, jobID int, errMsg string) {
	_, _ = db.Exec(`
		UPDATE video_platform_jobs 
		SET status = $1, error_msg = $2, updated_at = NOW() 
		WHERE id = $3
	`, models.JobStatusFailed, errMsg, jobID)
}
