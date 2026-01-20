package api

import (
	"database/sql"

	"example.com/creati/backend/internal/middleware"
	"example.com/creati/backend/internal/services"
	"example.com/creati/backend/internal/utils"
	"github.com/gofiber/fiber/v2"
)

type AnalyticsHandler struct {
	service *services.AnalyticsService
}

func NewAnalyticsHandler(db *sql.DB) *AnalyticsHandler {
	return &AnalyticsHandler{
		service: services.NewAnalyticsService(db),
	}
}

// GetOverview returns aggregated stats for the user
func (h *AnalyticsHandler) GetOverview(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "User not found")
	}

	// 1. Get Instant Stats from DB View (Fast)
	stats, err := h.service.GetUserStats(userID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Failed to fetch analytics")
	}

	// 2. Trigger Async Refresh (Non-blocking)
	go h.service.SyncUserAnalytics(userID)

	return utils.SuccessResponse(c, stats, "")
}
