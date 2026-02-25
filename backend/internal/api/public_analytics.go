package api

import (
	"database/sql"

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

// GetPublicReport returns high-level analytics for a client workspace via secure token
func (h *PublicAnalyticsHandler) GetPublicReport(c *fiber.Ctx) error {
	token := c.Params("token")
	if token == "" {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid report token")
	}

	// Fetch client by share_token and verify sharing is enabled
	var clientID int
	var clientName, logoURL, brandColor string
	var shareEnabled bool

	err := h.db.QueryRow(`
		SELECT id, name, COALESCE(logo_url, ''), COALESCE(color, '#08cea8'), share_enabled 
		FROM clients 
		WHERE share_token = $1
	`, token).Scan(&clientID, &clientName, &logoURL, &brandColor, &shareEnabled)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusNotFound, "report not found")
	}

	if !shareEnabled {
		return utils.ErrorResponse(c, fiber.StatusForbidden, "this report is not shared publicly")
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
