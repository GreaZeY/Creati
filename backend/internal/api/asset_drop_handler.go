package api

import (
	"database/sql"
	"fmt"
	"time"

	"creati.in/creati/backend/internal/services"
	"creati.in/creati/backend/internal/utils"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type AssetDropHandler struct {
	db      *sql.DB
	Storage *services.StorageService
	Usage   *services.StorageUsageService
}

func NewAssetDropHandler(db *sql.DB, s *services.StorageService, u *services.StorageUsageService) *AssetDropHandler {
	return &AssetDropHandler{
		db:      db,
		Storage: s,
		Usage:   u,
	}
}

// GetDropContext returns branding for the drop page
func (h *AssetDropHandler) GetDropContext(c *fiber.Ctx) error {
	token := c.Params("token")
	if _, err := uuid.Parse(token); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Invalid token")
	}

	var clientName, logoURL, color string
	err := h.db.QueryRow(`
		SELECT name, logo_url, color 
		FROM clients 
		WHERE drop_token = $1 AND drop_enabled = TRUE
	`, token).Scan(&clientName, &logoURL, &color)

	if err != nil {
		if err == sql.ErrNoRows {
			return utils.ErrorResponse(c, fiber.StatusNotFound, "Drop zone not found or disabled")
		}
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Database error", err)
	}

	return utils.SuccessResponse(c, fiber.Map{
		"clientName": clientName,
		"logoUrl":    logoURL,
		"color":      color,
	}, "")
}

type InitDropUploadRequest struct {
	Filename    string `json:"filename"`
	ContentType string `json:"contentType"`
	Size        int64  `json:"size"`
}

// InitDropUpload generates a presigned URL for guest upload
func (h *AssetDropHandler) InitDropUpload(c *fiber.Ctx) error {
	token := c.Params("token")
	var req InitDropUploadRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Invalid request")
	}

	// 1. Resolve Client and Org
	var clientID, orgID int
	err := h.db.QueryRow(`
		SELECT id, org_id FROM clients 
		WHERE drop_token = $1 AND drop_enabled = TRUE
	`, token).Scan(&clientID, &orgID)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusNotFound, "Invalid drop token")
	}

	// 2. Quota Check
	if err := h.Usage.CheckQuota(c.Context(), orgID, req.Size); err != nil {
		return utils.ErrorResponse(c, fiber.StatusForbidden, err.Error())
	}

	// 3. Resolve Provider
	provider, err := h.Storage.GetProvider(c.Context(), orgID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to resolve storage provider")
	}

	// 4. Generate Key: drop/{client_id}/{timestamp}_{filename}
	key := fmt.Sprintf("drop/%d/%d_%s", clientID, time.Now().Unix(), req.Filename)
	url, err := provider.GeneratePresignedURL(key, req.ContentType)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to generate upload URL")
	}

	return utils.SuccessResponse(c, fiber.Map{
		"uploadUrl": url,
		"key":       key,
	}, "")
}

type ConfirmDropUploadRequest struct {
	Key   string `json:"key"`
	Title string `json:"title"`
	Size  int64  `json:"size"`
}

// ConfirmDropUpload creates the video record for guest upload
func (h *AssetDropHandler) ConfirmDropUpload(c *fiber.Ctx) error {
	token := c.Params("token")
	var req ConfirmDropUploadRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Invalid request")
	}

	// Resolve Client and Org
	var clientID, orgID, userID int
	err := h.db.QueryRow(`
		SELECT id, org_id, user_id FROM clients 
		WHERE drop_token = $1 AND drop_enabled = TRUE
	`, token).Scan(&clientID, &orgID, &userID)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusNotFound, "Invalid drop token")
	}

	storageURL := h.Storage.GetObjectURL(req.Key)

	_, err = h.db.Exec(`
		INSERT INTO videos (user_id, client_id, title, s3_url, status, is_guest, size_bytes)
		VALUES ($1, $2, $3, $4, 'raw_drop', TRUE, $5)
	`, userID, clientID, req.Title, storageURL, req.Size)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to capture asset", err)
	}

	// Update org usage
	_ = h.Usage.UpdateUsage(c.Context(), orgID, req.Size)

	return utils.SuccessResponse(c, nil, "Asset dropped successfully!")
}
