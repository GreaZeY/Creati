package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"creati.in/creati/backend/internal/middleware"
	"creati.in/creati/backend/internal/services"
	"creati.in/creati/backend/internal/utils"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type PostsHandler struct {
	db      *sql.DB
	storage *services.StorageService
	queue   *services.QueueService
}

func NewPostsHandler(db *sql.DB, storage *services.StorageService, queue *services.QueueService) *PostsHandler {
	return &PostsHandler{
		db:      db,
		storage: storage,
		queue:   queue,
	}
}

type CreatePostRequest struct {
	Text        string     `json:"text"`
	PlatformIDs []string   `json:"platformIds"`
	MediaIDs    []string   `json:"mediaIds"`
	ScheduledAt *time.Time `json:"scheduledAt"`
}

// CreatePost handles post creation across multiple platforms
func (h *PostsHandler) CreatePost(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "Unauthorized")
	}

	clientID := getClientIDFromQuery(c)

	var req CreatePostRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Invalid request body")
	}

	// Validate
	if len(req.PlatformIDs) == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "At least one platform is required")
	}

	// Determine status based on scheduling
	status := "pending"
	scheduledStatus := sql.NullString{}
	var scheduledAt sql.NullTime

	if req.ScheduledAt != nil {
		status = "pending" // Scheduler will pick it up
		scheduledStatus = sql.NullString{String: "scheduled", Valid: true}
		scheduledAt = sql.NullTime{Time: *req.ScheduledAt, Valid: true}
	}

	// Generate trace ID for grouping
	traceID := uuid.New()

	// Create jobs for each platform
	jobIDs := []string{}
	tx, err := h.db.Begin()
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to start transaction", err)
	}
	defer tx.Rollback()

	for _, platformID := range req.PlatformIDs {
		// platformID from frontend is actually the account ID (platform_accounts.id)
		// Verify account exists and is connected
		var platform string
		err := tx.QueryRow(`
			SELECT platform FROM platform_accounts 
			WHERE user_id = $1 AND id = $2 AND connected = true
		`, userID, platformID).Scan(&platform)

		if err != nil {
			return utils.ErrorResponse(c, fiber.StatusBadRequest, 
				fmt.Sprintf("Platform account %s not found or not connected", platformID))
		}

		// Create automation job
		var jobID string
		progressData := map[string]interface{}{
			"text":       req.Text,
			"mediaIds":   req.MediaIDs,
			"accountId":  platformID,
			"platform":   platform,
		}
		progressJSON, _ := json.Marshal(progressData)

		err = tx.QueryRow(`
			INSERT INTO automation_jobs 
			(user_id, client_id, job_type, status, scheduled_status, scheduled_at, progress, trace_id, created_at, updated_at)
			VALUES ($1, $2, 'post', $3, $4, $5, $6, $7, NOW(), NOW())
			RETURNING id
		`, userID, clientID, status, scheduledStatus, scheduledAt, progressJSON, traceID).Scan(&jobID)

		if err != nil {
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to create job", err)
		}

		jobIDs = append(jobIDs, jobID)

		// Enqueue for immediate processing (scheduler will skip if scheduled)
		if h.queue != nil && req.ScheduledAt == nil {
			payload, _ := json.Marshal(map[string]interface{}{
				"job_id":      jobID,
				"account_id":  platformID,
				"platform":    platform,
				"text":        req.Text,
				"media_ids":   req.MediaIDs,
				"enqueued_at": time.Now(),
			})
			h.queue.Client.LPush(c.Context(), "queue:posts", payload)
		}
	}

	if err := tx.Commit(); err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to commit transaction", err)
	}

	message := "Post created successfully"
	if req.ScheduledAt != nil {
		message = fmt.Sprintf("Post scheduled for %s", req.ScheduledAt.Format("2006-01-02 15:04"))
	}

	return utils.SuccessResponse(c, fiber.Map{
		"id":     jobIDs[0],
		"jobIds": jobIDs,
		"traceId": traceID.String(),
	}, message)
}

// UploadMedia handles direct multipart file upload for posts
func (h *PostsHandler) UploadMedia(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "Unauthorized")
	}

	// Get uploaded file
	file, err := c.FormFile("file")
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "No file uploaded")
	}

	// Validate size (100MB max)
	if file.Size > 100*1024*1024 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "File too large (max 100MB)")
	}

	// Determine media type
	contentType := file.Header.Get("Content-Type")
	var mediaType string
	if contentType[:6] == "image/" {
		mediaType = "image"
	} else if contentType[:6] == "video/" {
		mediaType = "video"
	} else {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Only images and videos are allowed")
	}

	// Generate unique key
	mediaID := uuid.New().String()
	key := fmt.Sprintf("posts/%d/%s/%s", userID, mediaType,  file.Filename)

	// Open file stream
	src, err := file.Open()
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to read file")
	}
	defer src.Close()

	// Upload using StorageService
	if err := h.storage.Upload(c.Context(), key, src, contentType); err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to upload file", err)
	}

	// Get public URL
	url := h.storage.GetObjectURL(key)

	return utils.SuccessResponse(c, fiber.Map{
		"id":   mediaID,
		"url":  url,
		"type": mediaType,
	}, "Media uploaded successfully")
}
