package api

import (
	"database/sql"
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
		ID          string `json:"id"`
		Name        string `json:"name"`
		Platform    string `json:"platform"`
		Connected   bool   `json:"connected"`
		ProfileName string `json:"profileName,omitempty"`
	}
	platforms := make([]PlatformData, 0)

	for _, platform := range services.GetSupportedPlatforms() {
		info, ok := connected[platform]

		isConnected := false
		profileName := ""

		if ok {
			profileName = info.ProfileName // Always return profile name if we know it
			if info.Status == "connected" || info.Status == "active" {
				isConnected = true
			}
		}

		// Capitalize first letter for name
		name := platform
		if len(name) > 0 {
			name = string(name[0]-32) + name[1:]
		}
		if platform == "youtube" {
			name = "YouTube"
		}

		platforms = append(platforms, PlatformData{
			ID:          platform,
			Name:        name,
			Platform:    platform,
			Connected:   isConnected,
			ProfileName: profileName,
		})
	}

	return c.JSON(platforms)
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

	// Generate state token for security (should include userID)
	state := strconv.Itoa(userID) // Simplified - use secure state generation in production

	var authURL string

	// Type assertion to get auth URL based on platform type
	switch platform {
	case "youtube":
		// Optimize re-connect flow: if we have stored the connected account's email, use it as hint
		// Query platform_accounts table, NOT users table
		var email string
		_ = h.db.QueryRow("SELECT email FROM platform_accounts WHERE user_id = $1 AND platform = 'youtube'", userID).Scan(&email)

		ytService, ok := platformService.(*services.YouTubeService)
		if !ok {
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "youtube service error")
		}
		// Use login_hint if available to skip picker
		authURL = ytService.GetAuthURLWithHint(state, "consent", email)
	case "instagram":
		igService, ok := platformService.(*services.InstagramService)
		if !ok {
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "instagram service error")
		}
		authURL = igService.GetAuthURL(state)
	case "facebook":
		fbService, ok := platformService.(*services.FacebookService)
		if !ok {
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "facebook service error")
		}
		authURL = fbService.GetAuthURL(state)
	case "linkedin":
		liService, ok := platformService.(*services.LinkedInService)
		if !ok {
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "linkedin service error")
		}
		authURL = liService.GetAuthURL(state)
	case "twitter":
		twService, ok := platformService.(*services.TwitterService)
		if !ok {
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "twitter service error")
		}
		authURL = twService.GetAuthURL(state)
	case "discord":
		dsService, ok := platformService.(*services.DiscordService)
		if !ok {
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "discord service error")
		}
		authURL = dsService.GetAuthURL(state)
	case "reddit":
		rdService, ok := platformService.(*services.RedditService)
		if !ok {
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "reddit service error")
		}
		authURL = rdService.GetAuthURL(state)
	default:
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "unsupported platform for OAuth")
	}

	return utils.SuccessResponse(c, map[string]string{
		"authUrl": authURL,
	}, "")
}

// HandleCallback processes OAuth callback
func (h *PlatformHandler) HandleCallback(c *fiber.Ctx) error {
	platform := c.Params("platform")
	code := c.Query("code")
	state := c.Query("state") // Contains userID in simplified version

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

	// Redirect to frontend success page
	return c.Redirect("http://localhost:5173/connect?status=success&platform=" + platform)
}

// disconnectPlatformInternal handles token revocation and status updates (reusable logic)
func (h *PlatformHandler) disconnectPlatformInternal(userID int, platform string) error {
	// In production, add platform-specific revocation here
	// platformService, _ := services.GetPlatformService(platform, h.db)
	// if platformService != nil { _ = platformService.RevokeAccess(userID) }

	// Don't clear profile_name so we can show "Reconnect" vs "Connect"
	_, err := h.db.Exec(`
		UPDATE platform_accounts 
		SET status = 'disconnected' 
		WHERE user_id = $1 AND platform = $2
	`, userID, platform)
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
	platform := c.Params("platform")
	userID := middleware.GetUserID(c)

	// Always attempt to disconnect first (reusing logic as requested)
	_ = h.disconnectPlatformInternal(userID, platform)

	_, err := h.db.Exec(`
		DELETE FROM platform_accounts WHERE user_id = $1 AND platform = $2
	`, userID, platform)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to remove platform")
	}

	return utils.SuccessResponse(c, nil, "Platform removed successfully")
}
