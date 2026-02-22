package api

import (
	"database/sql"

	"creati.in/creati/backend/internal/middleware"
	"creati.in/creati/backend/internal/services"
	"creati.in/creati/backend/internal/utils"
	"github.com/gofiber/fiber/v2"
)

type AnalyticsHandler struct {
	service          *services.AnalyticsService
	recyclingService *services.RecyclingService
	queue            *services.QueueService
}

func NewAnalyticsHandler(db *sql.DB, queue *services.QueueService, cache *services.CacheService) *AnalyticsHandler {
	return &AnalyticsHandler{
		service:          services.NewAnalyticsService(db, cache),
		recyclingService: services.NewRecyclingService(db),
		queue:            queue,
	}
}

// GetOverview returns aggregated stats for the user or entire organization
func (h *AnalyticsHandler) GetOverview(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "User not found")
	}

	isGlobal := c.Query("global") == "true"
	clientID := middleware.GetClientID(c)

	var stats *services.UserStats
	var err error

	if isGlobal {
		stats, err = h.service.GetOrgStats(userID)
	} else {
		// 1. Get Instant Stats from DB (Fast)
		stats, err = h.service.GetUserStats(userID, clientID)
		// 2. Trigger Async Refresh (Non-blocking) - Only for client specific for now to save resources
		go h.service.SyncUserAnalytics(userID, clientID)
	}

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to fetch analytics", err)
	}

	return utils.SuccessResponse(c, stats, "")
}

// GetEvergreenSuggestions returns high-performing content for recycling
func (h *AnalyticsHandler) GetEvergreenSuggestions(c *fiber.Ctx) error {
	clientID := middleware.GetClientID(c)
	if clientID == nil || *clientID == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Client context required")
	}

	limit := c.QueryInt("limit", 5)
	suggestions, err := h.recyclingService.GetEvergreenSuggestions(c.Context(), *clientID, limit)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to fetch evergreen suggestions", err)
	}

	return utils.SuccessResponse(c, suggestions, "")
}

// GetQueueStatus returns the current depth of the upload queue (for autoscaling)
func (h *AnalyticsHandler) GetQueueStatus(c *fiber.Ctx) error {
	depth, err := h.queue.GetQueueDepth(c.Context(), services.QueueUpload)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to fetch queue depth", err)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"queue_name": "upload_queue",
			"depth":      depth,
			"status":     "healthy",
		},
	})
}
