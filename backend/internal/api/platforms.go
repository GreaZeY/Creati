package api

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strconv"
	"strings"

	"time"

	"creati.in/creati/backend/internal/db/repositories"
	"creati.in/creati/backend/internal/middleware"
	"creati.in/creati/backend/internal/services"
	"creati.in/creati/backend/internal/types"
	"creati.in/creati/backend/internal/utils"

	"github.com/gofiber/fiber/v2"
)

/**
 * Platform API handlers
 * Following Single Responsibility: ONLY handles platform connection endpoints
 * Uses Platform interface - doesn't know platform implementation details
 */

type PlatformHandler struct {
	db    *sql.DB
	cache *services.CacheService
}

func NewPlatformHandler(db *sql.DB, cache *services.CacheService) *PlatformHandler {
	return &PlatformHandler{db: db, cache: cache}
}

func (h *PlatformHandler) invalidateUserCache(ctx context.Context, userID int, clientID *int) {
	// Build a minimal context for cache key generation
	reqCtx := types.UserContext{UserID: userID, ClientID: clientID}

	// Invalidate both "list" and "counts" variants
	_ = h.cache.Delete(ctx, h.cache.GetAccountsKey(reqCtx, "list"))
	_ = h.cache.Delete(ctx, h.cache.GetAccountsKey(reqCtx, "counts"))

	// Special case: if we updated a client, also clear personal (for aggregated stats if any)
	if clientID != nil {
		personalCtx := types.UserContext{UserID: userID}
		_ = h.cache.Delete(ctx, h.cache.GetAccountsKey(personalCtx, "list"))
		_ = h.cache.Delete(ctx, h.cache.GetAccountsKey(personalCtx, "counts"))
	}
}

// GetPlatformCounts returns count of connected and total platform accounts
func (h *PlatformHandler) GetPlatformCounts(c *fiber.Ctx) error {
	ctx := middleware.GetContext(c)

	// Try Cache First
	var counts map[string]int
	cacheKey := h.cache.GetAccountsKey(ctx, "counts")

	if err := h.cache.Get(c.Context(), cacheKey, &counts); err == nil {
		return c.JSON(fiber.Map{"data": counts})
	}

	// Fetch all connected platforms
	var rows *sql.Rows
	var err error

	if ctx.ClientID != nil {
		rows, err = h.db.Query(`
			SELECT platform
			FROM platform_accounts 
			WHERE user_id = $1 AND client_id = $2 AND status IN ('active', 'connected', 'action_required')
		`, ctx.UserID, *ctx.ClientID)
	} else {
		rows, err = h.db.Query(`
			SELECT platform
			FROM platform_accounts 
			WHERE user_id = $1 AND client_id IS NULL AND status IN ('active', 'connected', 'action_required')
		`, ctx.UserID)
	}

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error", err)
	}
	defer rows.Close()

	counts = make(map[string]int)
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

	// Update Cache (5 min TTL)
	_ = h.cache.Set(c.Context(), cacheKey, counts, 5*time.Minute)

	return c.JSON(fiber.Map{
		"data": counts,
	})
}

// ListPlatforms returns list of available platforms and all connected accounts
func (h *PlatformHandler) ListPlatforms(c *fiber.Ctx) error {
	ctx := middleware.GetContext(c)

	type PlatformData struct {
		AccountID      int    `json:"accountId,omitempty"`
		ID             string `json:"id"` // Unique ID for frontend list (e.g., accountID or platform)
		Name           string `json:"name"`
		Platform       string `json:"platform"`
		Status         string `json:"status"`
		Connected      bool   `json:"connected"`
		ProfileName    string `json:"profileName,omitempty"`
		PlatformUserID string `json:"platformUserId,omitempty"`
		Handle         string `json:"handle"`
	}

	// Try Cache First
	var results []PlatformData
	cacheKey := h.cache.GetAccountsKey(ctx, "list")

	if err := h.cache.Get(c.Context(), cacheKey, &results); err == nil {
		return utils.SuccessResponse(c, results, "")
	}

	repo := repositories.NewPlatformRepository(h.db)
	accounts, err := repo.ListAccounts(c.Context(), ctx.UserID, ctx.ClientID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error", err)
	}

	results = make([]PlatformData, 0)
	connectedPlatforms := make(map[string]bool)

	// 1. Add all connected accounts
	for _, acc := range accounts {
		isConnected := (acc.Status == "connected" || acc.Status == "active" || acc.Status == "action_required")
		if isConnected {
			connectedPlatforms[acc.Platform] = true
		}

		// Capitalize first letter for display name
		displayName := acc.Platform
		if len(displayName) > 0 {
			displayName = string(displayName[0]-32) + displayName[1:]
		}
		if acc.Platform == "youtube" {
			displayName = "YouTube"
		}

		results = append(results, PlatformData{
			AccountID:      acc.ID,
			ID:             strconv.Itoa(acc.ID),
			Name:           displayName,
			Platform:       acc.Platform,
			Status:         acc.Status,
			Connected:      isConnected,
			ProfileName:    acc.ProfileName,
			PlatformUserID: acc.PlatformUserID,
			Handle:         acc.Handle,
		})
	}

	// Update Cache (5 min TTL)
	_ = h.cache.Set(c.Context(), cacheKey, results, 5*time.Minute)

	return utils.SuccessResponse(c, results, "")
}

// InitiateConnection returns OAuth URL for platform connection
func (h *PlatformHandler) InitiateConnection(c *fiber.Ctx) error {
	platform := c.Params("platform")
	ctx := middleware.GetContext(c)

	// Generate state token: "userID:clientID" or just "userID"
	state := strconv.Itoa(ctx.UserID)
	if ctx.ClientID != nil {
		state = fmt.Sprintf("%d:%d", ctx.UserID, *ctx.ClientID)
	}

	var authURL string

	// Check if the parameter is a platform name or an account ID
	accountID, errID := strconv.Atoi(platform)
	targetPlatform := platform
	isReconnect := errID == nil

	if isReconnect {
		// Reconnect specific account: get platform name and email hint
		var dbPlatform string
		var email sql.NullString
		err := h.db.QueryRow("SELECT platform, email FROM platform_accounts WHERE id = $1 AND user_id = $2", accountID, ctx.UserID).Scan(&dbPlatform, &email)
		if err != nil {
			log.Printf("Reconnect lookup failed for account %d (user %d): %v", accountID, ctx.UserID, err)
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
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to generate auth URL", fmt.Errorf("authURL is empty"))
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

	// Parse state to get userID and clientID
	// Format: "userID" or "userID:clientID"
	var userID int
	var clientID *int

	if parts := strings.Split(state, ":"); len(parts) == 2 {
		if uid, err := strconv.Atoi(parts[0]); err == nil {
			userID = uid
		}
		if cid, err := strconv.Atoi(parts[1]); err == nil {
			clientID = &cid
		}
	} else {
		if uid, err := strconv.Atoi(state); err == nil {
			userID = uid
		}
	}

	if userID == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid state parameter")
	}

	// Get platform service
	platformService, err := services.GetPlatformService(platform, h.db)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error())
	}

	// Authenticate using platform service
	err = platformService.Authenticate(code, userID, clientID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "authentication failed", err)
	}

	// Invalidate Cache
	h.invalidateUserCache(c.Context(), userID, clientID)

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
	ctx := middleware.GetContext(c)

	if err := h.disconnectPlatformInternal(ctx.UserID, platform); err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to disconnect platform", err)
	}

	// Invalidate Cache
	var clientID *int
	if accountID, errID := strconv.Atoi(platform); errID == nil {
		_ = h.db.QueryRow("SELECT client_id FROM platform_accounts WHERE id = $1", accountID).Scan(&clientID)
	}
	h.invalidateUserCache(c.Context(), ctx.UserID, clientID)

	return utils.SuccessResponse(c, nil, "Platform disconnected successfully")
}

// RemovePlatform (DELETE /api/platforms/:platform) - Hard removal
func (h *PlatformHandler) RemovePlatform(c *fiber.Ctx) error {
	target := c.Params("platform")
	ctx := middleware.GetContext(c)

	// Always attempt to disconnect first (reusing logic as requested)
	_ = h.disconnectPlatformInternal(ctx.UserID, target)

	// Check if target is a numeric account ID or a platform name
	accountID, errID := strconv.Atoi(target)

	var err error
	if errID == nil {
		// Target is an ID
		_, err = h.db.Exec(`
			DELETE FROM platform_accounts WHERE id = $1 AND user_id = $2
		`, accountID, ctx.UserID)
	} else {
		// Target is a platform name
		_, err = h.db.Exec(`
			DELETE FROM platform_accounts WHERE platform = $1 AND user_id = $2
		`, target, ctx.UserID)
	}

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to remove platform", err)
	}

	// Invalidate Cache
	var clientID *int
	if accountID, errID := strconv.Atoi(target); errID == nil {
		_ = h.db.QueryRow("SELECT client_id FROM platform_accounts WHERE id = $1", accountID).Scan(&clientID)
	}
	h.invalidateUserCache(c.Context(), ctx.UserID, clientID)

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
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to fetch recent videos", err)
	}

	return utils.SuccessResponse(c, videos, "Videos fetched successfully")
}
