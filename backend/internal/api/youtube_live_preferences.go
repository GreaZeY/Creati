package api

import (
	"creati.in/creati/backend/internal/middleware"
	"creati.in/creati/backend/internal/types"
	"creati.in/creati/backend/internal/utils"
	"github.com/gofiber/fiber/v2"
)

func (h *LiveHandler) Preferences(c *fiber.Ctx) error {
	p, err := h.repo.Preferences(c.UserContext(), middleware.GetContext(c))
	if err != nil {
		return liveError(c, err)
	}
	return utils.SuccessResponse(c, p, "")
}
func (h *LiveHandler) SavePreferences(c *fiber.Ctx) error {
	var p types.LivePreferences
	if len(c.Body()) > 4096 || c.BodyParser(&p) != nil {
		return utils.ErrorResponse(c, 400, "invalid preferences")
	}
	if err := p.Validate(); err != nil {
		return utils.ErrorResponse(c, 400, err.Error())
	}
	scope := middleware.GetContext(c)
	if p.AccountID > 0 {
		if err := h.repo.Account(c.UserContext(), scope, p.AccountID); err != nil {
			return liveError(c, err)
		}
	}
	if err := h.repo.SavePreferences(c.UserContext(), scope, p); err != nil {
		return liveError(c, err)
	}
	return utils.SuccessResponse(c, p, "")
}
func (h *LiveHandler) Reuse(c *fiber.Ctx) error {
	id, err := liveID(c)
	if err != nil {
		return utils.ErrorResponse(c, 400, "invalid draft ID")
	}
	result, err := h.repo.Reuse(c.UserContext(), middleware.GetContext(c), id)
	if err != nil {
		return liveError(c, err)
	}
	return utils.CreatedResponse(c, result)
}
