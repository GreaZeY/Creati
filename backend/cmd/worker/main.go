package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"math"
	"os"
	"os/signal"
	"syscall"
	"time"

	"example.com/creati/backend/internal/db/models"
	"example.com/creati/backend/internal/services"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

const (
	MaxRetries = 3
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("⚠️  No .env file found, using system environment")
	}

	// Connect to database
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("❌ DATABASE_URL not set.")
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal("❌ Failed to connect to database:", err)
	}
	defer db.Close()

	// Initialize services
	queueService, err := services.NewQueueService()
	if err != nil {
		log.Fatal("❌ Failed to initialize queue service:", err)
	}

	fmt.Println("\n========================================")
	fmt.Println("👷 Worker starting...")
	fmt.Println("========================================\n")

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
				log.Printf("❌ Error dequeuing job: %v", err)
				time.Sleep(2 * time.Second)
				continue
			}

			log.Printf("🚀 Processing job: VideoID=%d, Platform=%s", job.VideoID, job.Platform)

			// Process job
			err = processJob(db, job)
			if err != nil {
				log.Printf("❌ Job failed: %v", err)

				if job.RetryCount < MaxRetries {
					job.RetryCount++
					// Exponential backoff: 30s, 2m, 8m...
					delay := time.Duration(math.Pow(4, float64(job.RetryCount))) * time.Second * 30
					log.Printf("🔄 Retrying in %v (Attempt %d/%d)", delay, job.RetryCount, MaxRetries)

					go func(j services.UploadJob, d time.Duration) {
						time.Sleep(d)
						if err := queueService.EnqueueUpload(context.Background(), j); err != nil {
							log.Printf("❌ Failed to re-enqueue job: %v", err)
						}
					}(*job, delay)
				} else {
					log.Printf("💀 Max retries reached for job %d", job.JobID)
				}
			} else {
				log.Printf("✅ Job completed: VideoID=%d, Platform=%s", job.VideoID, job.Platform)
			}
		}
	}
}

func processJob(db *sql.DB, job *services.UploadJob) error {
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
	platformVideoID, err := platformSvc.Upload(video)
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

func updateJobError(db *sql.DB, jobID int, errMsg string) {
	_, _ = db.Exec(`
		UPDATE video_platform_jobs 
		SET status = $1, error_msg = $2, updated_at = NOW() 
		WHERE id = $3
	`, models.JobStatusFailed, errMsg, jobID)
}
