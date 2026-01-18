package api

import (
	"database/sql"
	"fmt"
	"time"

	"example.com/creati/backend/internal/services"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

type UploadHandler struct {
	Storage *services.StorageService
	db      *sql.DB
}

func NewUploadHandler(s *services.StorageService, db *sql.DB) *UploadHandler {
	return &UploadHandler{
		Storage: s,
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
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// Get User ID from context (set by auth middleware)
	userToken := c.Locals("user").(*jwt.Token)
	claims := userToken.Claims.(jwt.MapClaims)

	// Handle float64 conversion for JWT numbers often parsed as float64
	var userID string
	if uidFloat, ok := claims["user_id"].(float64); ok {
		userID = fmt.Sprintf("%d", int(uidFloat))
	} else {
		userID = fmt.Sprintf("%v", claims["user_id"])
	}

	// Generate unique key: uploads/{user_id}/{timestamp}_{filename}
	// Simple sanitization for filename could be added
	key := fmt.Sprintf("uploads/%s/%d_%s", userID, time.Now().Unix(), req.Filename)

	// Generate presigned URL
	url, err := h.Storage.GeneratePresignedURL(key, req.ContentType)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate upload URL"})
	}

	return c.JSON(fiber.Map{
		"uploadUrl": url,
		"key":       key,
	})
}
