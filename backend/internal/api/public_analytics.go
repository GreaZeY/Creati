package api

import (
	"database/sql"
	"strconv"

	"creati.in/creati/backend/internal/services"
	"creati.in/creati/backend/internal/utils"
	"github.com/gofiber/fiber/v2"
)

type PublicAnalyticsHandler struct {
	db               *sql.DB
	analyticsService *services.AnalyticsService
}

func NewPublicAnalyticsHandler(db *sql.DB, analyticsSvc *services.AnalyticsService) *PublicAnalyticsHandler {
	return &PublicAnalyticsHandler{
		db:               db,
		analyticsService: analyticsSvc,
	}
}

// GetPublicReport returns high-level analytics for a client workspace
// In a real app, this would require a secure share_token from the clients table
func (h *PublicAnalyticsHandler) GetPublicReport(c *fiber.Ctx) error {
	clientID, _ := strconv.Atoi(c.Params("clientId"))
	if clientID == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid client id")
	}

	// For MVP: We allow access if the client exists.
	// Production path: Check if shareLinkEnabled is TRUE and token matches.
	var clientName, logoURL, brandColor string
	err := h.db.QueryRow("SELECT name, COALESCE(logo_url, ''), COALESCE(color, '#08cea8') FROM clients WHERE id = $1", clientID).Scan(&clientName, &logoURL, &brandColor)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusNotFound, "report not found")
	}

	// Fetch actual metrics
	metrics, err := h.analyticsService.GetClientMetrics(c.Context(), clientID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to compute metrics", err)
	}

	return utils.SuccessResponse(c, fiber.Map{
		"clientName": clientName,
		"logoUrl":    logoURL,
		"brandColor": brandColor,
		"metrics":    metrics,
	}, "")
}
