package main

import (
	"context"
	"database/sql"
	"fmt"
	"math"
	"os"
	"os/signal"
	"syscall"
	"time"

	"creati.in/creati/backend/internal/db/models"
	"creati.in/creati/backend/internal/logger"
	"creati.in/creati/backend/internal/services"
	"github.com/joho/godotenv"
	"github.com/kkdai/youtube/v2"
	_ "github.com/lib/pq"
	"github.com/sirupsen/logrus"
)

const (
	MaxRetries = 3
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		logger.Get("worker").Warn("⚠️  No .env file found, using system environment")
	}

	// Connect to database
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		logger.Get("worker").Fatal("❌ DATABASE_URL not set.")
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		logger.Get("worker").WithField("error", err).Fatal("❌ Failed to connect to database")
	}
	defer db.Close()

	// Initialize services
	queueService, err := services.NewQueueService()
	if err != nil {
		logger.Get("worker").WithField("error", err).Fatal("❌ Failed to initialize queue service")
	}

	storageService, err := services.NewStorageService()
	if err != nil {
		logger.Get("worker").WithField("error", err).Warn("⚠️  Storage service failed to initialize")
	}

	fmt.Println("\n========================================")
	logger.Get("worker").Info("Worker starting...")
	fmt.Println("========================================")

	// Context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		fmt.Println("\n🛑 Shutting down worker...")
		cancel()
	}()

	// Worker loop
	for {
		select {
		case <-ctx.Done():
			return
		default:
			// Fetch job from Redis
			job, err := queueService.DequeueUpload(ctx)
			if err != nil {
				if ctx.Err() != nil {
					return
				}
				logger.Get("worker").WithField("error", err).Error("❌ Error dequeuing job")
				time.Sleep(2 * time.Second)
				continue
			}

			logger.Get("worker").WithFields(logrus.Fields{
				"video_id": job.VideoID,
				"platform": job.Platform,
			}).Info("Processing job")

			// Process job
			err = processJob(db, storageService, job)
			if err != nil {
				logger.Get("worker").WithField("error", err).Error("Job failed")

				if job.RetryCount < MaxRetries {
					job.RetryCount++
					// Exponential backoff: 30s, 2m, 8m...
					delay := time.Duration(math.Pow(4, float64(job.RetryCount))) * time.Second * 30
					logger.Get("worker").WithFields(logrus.Fields{
						"attempt":     job.RetryCount,
						"max_retries": MaxRetries,
						"delay":       delay,
					}).Info("Retrying job")

					go func(j services.UploadJob, d time.Duration) {
						time.Sleep(d)
						if err := queueService.EnqueueUpload(context.Background(), j); err != nil {
							logger.Get("worker").WithField("error", err).Error("Failed to re-enqueue job")
						}
					}(*job, delay)
				} else {
					logger.Get("worker").WithField("job_id", job.JobID).Error("Max retries reached")
					if job.AutomationJobID > 0 {
						db.Exec("UPDATE automation_jobs SET status = 'failed', error = $1 WHERE id = $2", err.Error(), job.AutomationJobID)
					}
				}
			} else {
				logger.Get("worker").WithFields(logrus.Fields{
					"video_id": job.VideoID,
					"platform": job.Platform,
				}).Info("Job completed")
			}
		}
	}
}

func processJob(db *sql.DB, storage *services.StorageService, job *services.UploadJob) error {
	if job.AutomationJobID > 0 {
		return handleAutomationJob(db, storage, job)
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
	accountID := job.AccountID
	if accountID == 0 {
		// Fallback: try to find the account_id if it's missing (legacy jobs)
		_ = db.QueryRow("SELECT account_id FROM video_platform_jobs WHERE id = $1", job.JobID).Scan(&accountID)
	}

	platformVideoID, err := platformSvc.Upload(video, accountID)
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

func handleAutomationJob(db *sql.DB, storage *services.StorageService, job *services.UploadJob) error {
	logger.Get("automation").WithFields(logrus.Fields{
		"automation_job_id": job.AutomationJobID,
		"source_video_id":   job.SourceVideoID,
	}).Info("Processing Automation Job")

	// Update status
	_, err := db.Exec("UPDATE automation_jobs SET status = 'processing', updated_at = NOW() WHERE id = $1", job.AutomationJobID)
	if err != nil {
		return err
	}

	// 1. Get Target Details (for title/description)
	var userID int
	var ruleName string
	err = db.QueryRow(`
		SELECT user_id, name FROM automation_rules WHERE id = (SELECT rule_id FROM automation_jobs WHERE id = $1)
	`, job.AutomationJobID).Scan(&userID, &ruleName)
	if err != nil {
		return fmt.Errorf("failed to fetch rule details: %w", err)
	}

	// 2. Download from YouTube
	client := youtube.Client{}
	videoMetadata, err := client.GetVideo(job.SourceVideoID)
	if err != nil {
		return fmt.Errorf("failed to fetch youtube metadata: %w", err)
	}

	formats := videoMetadata.Formats.WithAudioChannels()
	stream, _, err := client.GetStream(videoMetadata, &formats[0])
	if err != nil {
		return fmt.Errorf("failed to get youtube stream: %w", err)
	}
	defer stream.Close()

	// 3. Stage in S3
	s3Key := fmt.Sprintf("automation/%d/%d_%s.mp4", userID, job.AutomationJobID, job.SourceVideoID)
	err = storage.Upload(context.Background(), s3Key, stream, "video/mp4")
	if err != nil {
		return fmt.Errorf("failed to stage video in S3: %w", err)
	}

	s3URL := storage.GetObjectURL(s3Key)

	// 4. Create transient Video model
	video := &models.Video{
		UserID:      userID,
		Title:       videoMetadata.Title,
		Description: fmt.Sprintf("Automatically synced from YouTube: %s\n\nRule: %s", videoMetadata.Description, ruleName),
		S3URL:       s3URL,
	}

	// 5. Proceed with normal Upload
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

func updateJobError(db *sql.DB, jobID int, errMsg string) {
	_, _ = db.Exec(`
		UPDATE video_platform_jobs 
		SET status = $1, error_msg = $2, updated_at = NOW() 
		WHERE id = $3
	`, models.JobStatusFailed, errMsg, jobID)
}
