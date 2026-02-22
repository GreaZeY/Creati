package api

import (
	"database/sql"
	"strconv"

	"creati.in/creati/backend/internal/middleware"
	"creati.in/creati/backend/internal/services"
	"creati.in/creati/backend/internal/utils"
	"github.com/gofiber/fiber/v2"
)

type EvergreenHandler struct {
	recycling *services.RecyclingService
}

func NewEvergreenHandler(db *sql.DB) *EvergreenHandler {
	return &EvergreenHandler{
		recycling: services.NewRecyclingService(db),
	}
}

// List returns pending content recycling suggestions for the current user / client scope
func (h *EvergreenHandler) List(c *fiber.Ctx) error {
	ctx := middleware.GetContext(c)

	suggestions, err := h.recycling.ListSuggestions(c.Context(), ctx.UserID, ctx.ClientID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to list suggestions", err)
	}

	return utils.SuccessResponse(c, suggestions, "")
}

// Approve schedules a suggested post for real distribution
func (h *EvergreenHandler) Approve(c *fiber.Ctx) error {
	ctx := middleware.GetContext(c)
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid suggestion id")
	}

	if err := h.recycling.UpdateSuggestionStatus(c.Context(), id, ctx.UserID, "approved"); err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to approve suggestion", err)
	}

	return utils.SuccessResponse(c, nil, "Suggestion approved and queued for distribution")
}

// Dismiss removes a suggestion from the queue
func (h *EvergreenHandler) Dismiss(c *fiber.Ctx) error {
	ctx := middleware.GetContext(c)
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid suggestion id")
	}

	if err := h.recycling.UpdateSuggestionStatus(c.Context(), id, ctx.UserID, "dismissed"); err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to dismiss suggestion", err)
	}

	return utils.SuccessResponse(c, nil, "Suggestion dismissed")
}
