package api

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"time"

	"example.com/creati/backend/internal/middleware"
	"example.com/creati/backend/internal/services"
	"example.com/creati/backend/internal/utils"
	"github.com/gofiber/fiber/v2"
)

type UploadHandler struct {
	Storage *services.StorageService
	Queue   *services.QueueService
	db      *sql.DB
}

func NewUploadHandler(s *services.StorageService, q *services.QueueService, db *sql.DB) *UploadHandler {
	return &UploadHandler{
		Storage: s,
		Queue:   q,
		db:      db,
	}
}

type InitUploadRequest struct {
	Filename    string `json:"filename"`
	ContentType string `json:"contentType"`
	Size        int64  `json:"size"`
}

func (h *UploadHandler) InitUpload(c *fiber.Ctx) error {
	var req InitUploadRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Invalid request")
	}

	userID := middleware.GetUserID(c)
	if userID == 0 {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "User not found")
	}

	// Generate unique key: uploads/{user_id}/{timestamp}_{filename}
	key := fmt.Sprintf("uploads/%d/%d_%s", userID, time.Now().Unix(), req.Filename)

	// Generate presigned URL
	if h.Storage == nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Storage service not initialized. Check AWS credentials.")
	}
	url, err := h.Storage.GeneratePresignedURL(key, req.ContentType)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to generate upload URL")
	}

	return utils.SuccessResponse(c, fiber.Map{
		"uploadUrl": url,
		"key":       key,
	}, "")
}

type ConfirmUploadRequest struct {
	Key         string   `json:"key"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Platforms   []string `json:"platforms"`
}

func (h *UploadHandler) ConfirmUpload(c *fiber.Ctx) error {
	var req ConfirmUploadRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Invalid request")
	}

	userID := middleware.GetUserID(c)
	if userID == 0 {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "User not found")
	}

	// Construct full S3 URL
	bucket := os.Getenv("AWS_S3_BUCKET")
	if bucket == "" {
		bucket = "creati-uploads-dev"
	}
	s3URL := fmt.Sprintf("https://%s.s3.amazonaws.com/%s", bucket, req.Key)

	// Start transaction
	tx, err := h.db.Begin()
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to start transaction")
	}
	defer tx.Rollback()

	// 1. Create Video record
	var videoID int
	err = tx.QueryRow(`
		INSERT INTO videos (user_id, title, description, s3_url, status)
		VALUES ($1, $2, $3, $4, 'uploaded')
		RETURNING id
	`, userID, req.Title, req.Description, s3URL).Scan(&videoID)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to save video metadata")
	}

	// 2. Create Platform Jobs & Enqueue
	for _, platform := range req.Platforms {
		var jobID int
		err = tx.QueryRow(`
			INSERT INTO video_platform_jobs (video_id, platform, status)
			VALUES ($1, $2, 'pending')
			RETURNING id
		`, videoID, platform).Scan(&jobID)

		if err != nil {
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to queue platform jobs")
		}

		// Enqueue to Redis
		if h.Queue != nil {
			err = h.Queue.EnqueueUpload(context.Background(), services.UploadJob{
				VideoID:    videoID,
				JobID:      jobID,
				Platform:   platform,
				RetryCount: 0,
			})
			if err != nil {
				// Don't fail the whole request if Redis fails, but log it
				fmt.Printf("⚠️  Failed to enqueue job to Redis: %v\n", err)
			}
		}
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to commit transaction")
	}

	return utils.SuccessResponse(c, fiber.Map{
		"videoId": videoID,
		"status":  "queued",
	}, "Upload confirmed and jobs queued")
}
