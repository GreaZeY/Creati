package api

import (
	"database/sql"

	"example.com/creati/backend/internal/middleware"
	"example.com/creati/backend/internal/services"
	"example.com/creati/backend/internal/utils"

	"github.com/gofiber/fiber/v2"
)

/**
 * Platform API handlers
 * Following Single Responsibility: ONLY handles platform connection endpoints
 * Uses Platform interface - doesn't know platform implementation details
 */

type PlatformHandler struct {
	db *sql.DB
}

func NewPlatformHandler(db *sql.DB) *PlatformHandler {
	return &PlatformHandler{db: db}
}

// ListPlatforms returns list of available platforms and connection status
func (h *PlatformHandler) ListPlatforms(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	// Get connected platforms for user
	rows, err := h.db.Query(`
		SELECT platform, status, COALESCE(profile_name, '') as profile_name FROM platform_accounts WHERE user_id = $1
	`, userID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error")
	}
	defer rows.Close()

	type PlatformInfo struct {
		Status      string
		ProfileName string
	}
	connected := make(map[string]PlatformInfo)

	for rows.Next() {
		var platform, status, profileName string
		if err := rows.Scan(&platform, &status, &profileName); err != nil {
			continue
		}
		connected[platform] = PlatformInfo{Status: status, ProfileName: profileName}
	}

	// Build response with all supported platforms
	// Build response: keys = platform ID, value = is connected
	// Build response
	type PlatformData struct {
		Connected   bool   `json:"connected"`
		ProfileName string `json:"profileName,omitempty"`
	}
	platforms := make(map[string]PlatformData)

	for _, platform := range services.GetSupportedPlatforms() {
		info, ok := connected[platform]

		isConnected := false
		profileName := ""

		if ok && (info.Status == "connected" || info.Status == "active") {
			isConnected = true
			profileName = info.ProfileName
		}

		platforms[platform] = PlatformData{
			Connected:   isConnected,
			ProfileName: profileName,
		}
	}

	return utils.SuccessResponse(c, platforms, "")
}

// InitiateConnection returns OAuth URL for platform connection
func (h *PlatformHandler) InitiateConnection(c *fiber.Ctx) error {
	platform := c.Params("platform")
	userID := middleware.GetUserID(c)

	// Get platform service using factory (Open/Closed principle)
	platformService, err := services.GetPlatformService(platform, h.db)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error())
	}

	// Type assertion to get auth URL (YouTube-specific for now)
	// In production, add GetAuthURL to Platform interface
	youtubeService, ok := platformService.(*services.YouTubeService)
	if !ok {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "platform service error")
	}

	// Generate state token for security (should include userID)
	state := string(userID) // Simplified - use secure state generation in production

	authURL := youtubeService.GetAuthURL(state)
	return utils.SuccessResponse(c, map[string]string{
		"authUrl": authURL,
	}, "")
}

// HandleCallback processes OAuth callback
func (h *PlatformHandler) HandleCallback(c *fiber.Ctx) error {
	platform := c.Params("platform")
	code := c.Query("code")
	// state := c.Query("state") // Contains userID in simplified version
	// Verify state usually here (omitted for brevity/MVP)

	if code == "" {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "missing authorization code")
	}

	// In production: validate state token and extract userID securely
	userID := 1 // Simplified - extract from state

	// Get platform service
	platformService, err := services.GetPlatformService(platform, h.db)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error())
	}

	// Authenticate using platform service
	err = platformService.Authenticate(code, userID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "authentication failed: "+err.Error())
	}

	// Redirect to frontend success page
	return c.Redirect("http://localhost:5173/connect?status=success&platform=" + platform)
}

// DisconnectPlatform removes platform connection
func (h *PlatformHandler) DisconnectPlatform(c *fiber.Ctx) error {
	platform := c.Params("platform")
	userID := middleware.GetUserID(c)

	_, err := h.db.Exec(`
		DELETE FROM platform_accounts WHERE user_id = $1 AND platform = $2
	`, userID, platform)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to disconnect")
	}

	return utils.SuccessResponse(c, nil, "platform disconnected")
}
