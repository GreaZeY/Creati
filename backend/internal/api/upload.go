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
)

type UploadHandler struct {
	Storage *services.StorageService
	Usage   *services.StorageUsageService
	Queue   *services.QueueService
	db      *sql.DB
}

func NewUploadHandler(s *services.StorageService, u *services.StorageUsageService, q *services.QueueService, db *sql.DB) *UploadHandler {
	return &UploadHandler{
		Storage: s,
		Usage:   u,
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

	// Quota Check (Skip if org has BYO, or check bypass)
	var orgID int
	err := h.db.QueryRow("SELECT organization_id FROM user_organizations WHERE user_id = $1 AND role = 'owner' LIMIT 1", userID).Scan(&orgID)
	if err == nil {
		if err := h.Usage.CheckQuota(c.Context(), orgID, req.Size); err != nil {
			return utils.ErrorResponse(c, fiber.StatusForbidden, err.Error())
		}
	}

	// Generate presigned URL
	if h.Storage == nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Storage service not initialized. Check AWS credentials.")
	}
	url, err := h.Storage.GeneratePresignedURL(key, req.ContentType)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to generate upload URL", err)
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
	Platforms   []string `json:"platforms"`  // Legacy/Optional
	AccountIDs  []int    `json:"accountIds"` // Specific accounts
	ClientID    *int     `json:"clientId"`
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

	// Resolve target accounts
	targetAccounts := make(map[int]string) // accountID -> platform

	// 1. Add explicitly requested accounts
	if len(req.AccountIDs) > 0 {
		rows, err := h.db.Query("SELECT id, platform FROM platform_accounts WHERE id = ANY($1) AND user_id = $2", req.AccountIDs, userID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var id int
				var platform string
				if err := rows.Scan(&id, &platform); err == nil {
					targetAccounts[id] = platform
				}
			}
		}
	}

	// 2. Fallback: Add first account for each platform if legacy "platforms" provided
	for _, platform := range req.Platforms {
		var accountID int
		err := h.db.QueryRow("SELECT id FROM platform_accounts WHERE user_id = $1 AND platform = $2 LIMIT 1", userID, platform).Scan(&accountID)
		if err == nil {
			targetAccounts[accountID] = platform
		}
	}

	if len(targetAccounts) == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "No connected accounts found for selected platforms")
	}

	// Start transaction
	tx, err := h.db.Begin()
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to start transaction", err)
	}
	defer tx.Rollback()

	// 1. Create Video record
	var videoID int
	storageURL := h.Storage.GetObjectURL(req.Key)

	err = tx.QueryRow(`
		INSERT INTO videos (user_id, client_id, title, description, storage_url, status)
		VALUES ($1, $2, $3, $4, $5, 'uploaded')
		RETURNING id
	`, userID, req.ClientID, req.Title, req.Description, storageURL).Scan(&videoID)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to save video metadata", err)
	}

	// 2. Normalize Content (V2)
	normalizer := services.NewContentNormalizer(h.db)
	normalized, err := normalizer.NormalizeContent(
		c.Context(),
		"creati", // Manual upload origin
		fmt.Sprintf("%d", videoID),
		req.Title,
		req.Description,
		0,       // Duration not known yet
		req.Key, // Staged Storage Key
	)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to normalize content", err)
	}

	// 3. Create Automation Executions & Enqueue (V2)
	for accountID, platform := range targetAccounts {
		var executionID string
		err = tx.QueryRow(`
			INSERT INTO automation_executions 
			(content_id, client_id, rule_id, source_platform, target_platform, target_account_id, status, trace_id)
			VALUES ($1, $2, $3, $4, $5, $6, 'queued', gen_random_uuid())
			RETURNING id
		`, normalized.ContentID, req.ClientID, 0, platform, accountID).Scan(&executionID)

		if err != nil {
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to create execution record", err)
		}

		// Enqueue V2 Payload
		if h.Queue != nil {
			payload, _ := json.Marshal(map[string]interface{}{
				"content_id":      normalized.ContentID,
				"target_platform": platform,
				"account_id":      accountID,
				"execution_id":    executionID,
				"enqueued_at":     time.Now(),
			})
			h.Queue.Client.LPush(c.Context(), services.QueueUpload, payload)
		}
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to commit transaction", err)
	}

	return utils.SuccessResponse(c, fiber.Map{
		"videoId":   videoID,
		"contentId": normalized.ContentID,
		"status":    "queued",
	}, "Upload confirmed and jobs queued")
}
