package api

import (
	"database/sql"
	"log"
	"strconv"

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

// GetPlatformCounts returns count of connected and total platform accounts
func (h *PlatformHandler) GetPlatformCounts(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	// Fetch all connected platforms
	rows, err := h.db.Query(`
		SELECT platform
		FROM platform_accounts 
		WHERE user_id = $1 AND status IN ('active', 'connected')
	`, userID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error")
	}
	defer rows.Close()

	counts := make(map[string]int)
	totalConnected := 0

	for rows.Next() {
		var platform string
		if err := rows.Scan(&platform); err != nil {
			continue
		}
		counts[platform]++
		totalConnected++
	}

	// Add total to the map
	counts["total"] = totalConnected

	return c.JSON(fiber.Map{
		"data": counts,
	})
}

// ListPlatforms returns list of available platforms and all connected accounts
func (h *PlatformHandler) ListPlatforms(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	// Get all connected accounts for user
	rows, err := h.db.Query(`
		SELECT id, platform, status, COALESCE(profile_name, '') as profile_name, platform_user_id, COALESCE(handle, '') as handle
		FROM platform_accounts 
		WHERE user_id = $1
	`, userID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error")
	}
	defer rows.Close()

	type PlatformData struct {
		AccountID      int    `json:"accountId,omitempty"`
		ID             string `json:"id"` // Unique ID for frontend list (e.g., accountID or platform)
		Name           string `json:"name"`
		Platform       string `json:"platform"`
		Connected      bool   `json:"connected"`
		ProfileName    string `json:"profileName,omitempty"`
		PlatformUserID string `json:"platformUserId,omitempty"`
		Handle         string `json:"handle"`
	}

	results := make([]PlatformData, 0)
	connectedPlatforms := make(map[string]bool)

	// 1. Add all connected accounts
	for rows.Next() {
		var accountID int
		var platform, status, profileName, platformUserID, handle string
		if err := rows.Scan(&accountID, &platform, &status, &profileName, &platformUserID, &handle); err != nil {
			continue
		}

		isConnected := (status == "connected" || status == "active")
		if isConnected {
			connectedPlatforms[platform] = true
		}

		// Capitalize first letter for display name
		displayName := platform
		if len(displayName) > 0 {
			displayName = string(displayName[0]-32) + displayName[1:]
		}
		if platform == "youtube" {
			displayName = "YouTube"
		}

		results = append(results, PlatformData{
			AccountID:      accountID,
			ID:             strconv.Itoa(accountID),
			Name:           displayName,
			Platform:       platform,
			Connected:      isConnected,
			ProfileName:    profileName,
			PlatformUserID: platformUserID,
			Handle:         handle,
		})
	}

	return utils.SuccessResponse(c, results, "")
}

// InitiateConnection returns OAuth URL for platform connection
func (h *PlatformHandler) InitiateConnection(c *fiber.Ctx) error {
	platform := c.Params("platform")
	userID := middleware.GetUserID(c)
	// Generate state token for security (should include userID)
	state := strconv.Itoa(userID) // Simplified - use secure state generation in production

	var authURL string

	// Check if the parameter is a platform name or an account ID
	accountID, errID := strconv.Atoi(platform)
	targetPlatform := platform
	isReconnect := errID == nil

	if isReconnect {
		// Reconnect specific account: get platform name and email hint
		var dbPlatform string
		var email sql.NullString
		err := h.db.QueryRow("SELECT platform, email FROM platform_accounts WHERE id = $1 AND user_id = $2", accountID, userID).Scan(&dbPlatform, &email)
		if err != nil {
			log.Printf("Reconnect lookup failed for account %d (user %d): %v", accountID, userID, err)
			return utils.ErrorResponse(c, fiber.StatusNotFound, "account not found or unauthorized")
		}
		targetPlatform = dbPlatform
		emailHint := email.String

		// Initialize service with correct platform
		platformService, errSvc := services.GetPlatformService(targetPlatform, h.db)
		if errSvc != nil {
			return utils.ErrorResponse(c, fiber.StatusBadRequest, errSvc.Error())
		}

		// Use standardized GetAuthURLWithHint for all platforms
		// For reconnect, we use "consent" prompt to ensure fresh token acquisition
		authURL = platformService.GetAuthURLWithHint(state, "consent", emailHint)
	} else {
		// New connection
		platformService, errSvc := services.GetPlatformService(targetPlatform, h.db)
		if errSvc != nil {
			return utils.ErrorResponse(c, fiber.StatusBadRequest, errSvc.Error())
		}

		if targetPlatform == "youtube" {
			ytService := platformService.(*services.YouTubeService)
			// "select_account" ensures user can pick a different account
			authURL = ytService.GetAuthURLWithHint(state, "select_account consent", "")
		} else {
			authURL = platformService.GetAuthURL(state)
		}
	}

	if authURL == "" {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to generate auth URL")
	}

	return utils.SuccessResponse(c, map[string]string{
		"authUrl": authURL,
	}, "")
}

// HandleCallback processes OAuth callback (JSON POST from frontend)
func (h *PlatformHandler) HandleCallback(c *fiber.Ctx) error {
	platform := c.Params("platform")

	var payload struct {
		Code  string `json:"code"`
		State string `json:"state"`
	}

	if err := c.BodyParser(&payload); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request body")
	}

	code := payload.Code
	state := payload.State

	if code == "" {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "missing authorization code")
	}

	// In production: validate state token and extract userID securely
	userID, err := strconv.Atoi(state)
	if err != nil {
		userID = 1 // Fallback if state parsing fails (should handle error better in prod)
	}

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

	// Return success JSON
	return utils.SuccessResponse(c, fiber.Map{
		"platform": platform,
		"status":   "connected",
	}, "Successfully connected to "+platform)
}

// disconnectPlatformInternal handles token revocation and status updates (reusable logic)
func (h *PlatformHandler) disconnectPlatformInternal(userID int, target string) error {
	// Check if target is a numeric account ID or a platform name
	accountID, errID := strconv.Atoi(target)

	var err error
	if errID == nil {
		// Target is an ID
		_, err = h.db.Exec(`
			UPDATE platform_accounts 
			SET status = 'disconnected' 
			WHERE id = $1 AND user_id = $2
		`, accountID, userID)
	} else {
		// Target is a platform name (legacy support or mass-disconnect)
		_, err = h.db.Exec(`
			UPDATE platform_accounts 
			SET status = 'disconnected' 
			WHERE platform = $1 AND user_id = $2
		`, target, userID)
	}
	return err
}

// DeactivatePlatform (PUT /api/platforms/:platform/disconnect) - Soft disconnect
func (h *PlatformHandler) DeactivatePlatform(c *fiber.Ctx) error {
	platform := c.Params("platform")
	userID := middleware.GetUserID(c)

	if err := h.disconnectPlatformInternal(userID, platform); err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to disconnect platform")
	}

	return utils.SuccessResponse(c, nil, "Platform disconnected successfully")
}

// RemovePlatform (DELETE /api/platforms/:platform) - Hard removal
func (h *PlatformHandler) RemovePlatform(c *fiber.Ctx) error {
	target := c.Params("platform")
	userID := middleware.GetUserID(c)

	// Always attempt to disconnect first (reusing logic as requested)
	_ = h.disconnectPlatformInternal(userID, target)

	// Check if target is a numeric account ID or a platform name
	accountID, errID := strconv.Atoi(target)

	var err error
	if errID == nil {
		// Target is an ID
		_, err = h.db.Exec(`
			DELETE FROM platform_accounts WHERE id = $1 AND user_id = $2
		`, accountID, userID)
	} else {
		// Target is a platform name
		_, err = h.db.Exec(`
			DELETE FROM platform_accounts WHERE platform = $1 AND user_id = $2
		`, target, userID)
	}

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to remove platform")
	}

	return utils.SuccessResponse(c, nil, "Platform removed successfully")
}

// GetRecentVideos (GET /api/platforms/:platform/videos?accountId=...)
func (h *PlatformHandler) GetRecentVideos(c *fiber.Ctx) error {
	platformName := c.Params("platform")
	accountIDStr := c.Query("accountId")

	if accountIDStr == "" {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "accountId is required")
	}

	accountID, err := strconv.Atoi(accountIDStr)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid accountId")
	}

	// Create platform service using factory
	svc, err := services.GetPlatformService(platformName, h.db)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid platform")
	}

	videos, err := svc.FetchRecentVideos(accountID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, err.Error())
	}

	return utils.SuccessResponse(c, videos, "Videos fetched successfully")
}
