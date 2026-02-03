package api

import (
	"database/sql"
	"strconv"

	"creati.in/creati/backend/internal/middleware"
	"creati.in/creati/backend/internal/services"
	"creati.in/creati/backend/internal/utils"
	"github.com/gofiber/fiber/v2"
)

type AnalyticsHandler struct {
	service *services.AnalyticsService
	queue   *services.QueueService
}

func NewAnalyticsHandler(db *sql.DB, queue *services.QueueService, cache *services.CacheService) *AnalyticsHandler {
	return &AnalyticsHandler{
		service: services.NewAnalyticsService(db, cache),
		queue:   queue,
	}
}

// GetOverview returns aggregated stats for the user
func (h *AnalyticsHandler) GetOverview(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "User not found")
	}

	clientIDStr := c.Query("clientId")
	var clientID *int
	if clientIDStr != "" {
		if cid, err := strconv.Atoi(clientIDStr); err == nil {
			clientID = &cid
		}
	}

	// 1. Get Instant Stats from DB (Fast)
	stats, err := h.service.GetUserStats(userID, clientID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to fetch analytics", err)
	}

	// 2. Trigger Async Refresh (Non-blocking)
	go h.service.SyncUserAnalytics(userID, clientID)

	return utils.SuccessResponse(c, stats, "")
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
