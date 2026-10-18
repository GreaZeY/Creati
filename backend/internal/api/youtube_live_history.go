package api

import (
	"bytes"
	"context"
	"fmt"
	"regexp"
	"strconv"
	"time"

	"creati.in/creati/backend/internal/middleware"
	"creati.in/creati/backend/internal/services"
	"creati.in/creati/backend/internal/types"
	"creati.in/creati/backend/internal/utils"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func (h *LiveHandler) historyAccount(c *fiber.Ctx) (int, error) {
	id, err := strconv.Atoi(c.Params("account"))
	if err != nil || id < 1 {
		return 0, fmt.Errorf("invalid channel")
	}
	return id, h.repo.Account(c.UserContext(), middleware.GetContext(c), id)
}
func (h *LiveHandler) History(c *fiber.Ctx) error {
	account, err := h.historyAccount(c)
	if err != nil {
		return utils.ErrorResponse(c, 404, "channel not found in this workspace")
	}
	token := c.Query("pageToken")
	if len(token) > 1024 {
		return utils.ErrorResponse(c, 400, "invalid history page")
	}
	ctx, cancel := context.WithTimeout(c.UserContext(), 30*time.Second)
	defer cancel()
	page, err := h.history.LiveHistory(ctx, account, token)
	if err != nil {
		return utils.ErrorResponse(c, 502, err.Error())
	}
	return utils.SuccessResponse(c, page, "")
}

var liveBroadcastID = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,128}$`)

func (h *LiveHandler) ReuseYouTube(c *fiber.Ctx) error {
	account, err := h.historyAccount(c)
	if err != nil {
		return utils.ErrorResponse(c, 404, "channel not found in this workspace")
	}
	id := c.Params("broadcast")
	if !liveBroadcastID.MatchString(id) {
		return utils.ErrorResponse(c, 400, "invalid broadcast ID")
	}
	ctx, cancel := context.WithTimeout(c.UserContext(), 45*time.Second)
	defer cancel()
	previous, err := h.history.LivePrevious(ctx, account, id)
	if err != nil {
		return utils.ErrorResponse(c, 502, err.Error())
	}
	scope := middleware.GetContext(c)
	prefs, err := h.repo.Preferences(ctx, scope)
	if err != nil {
		return liveError(c, err)
	}
	previous.Preferences.AccountID = account
	previous.Preferences.TimeZone = prefs.TimeZone
	if previous.Preferences.Language == "" {
		previous.Preferences.Language = prefs.Language
	}
	source := &types.LiveDraft{Idea: previous.Idea, Package: previous.Package}
	warning := ""
	if previous.ThumbnailURL != "" && h.storage != nil {
		data, thumbErr := services.PreviousLiveThumbnail(ctx, previous.ThumbnailURL)
		if thumbErr == nil {
			key := "youtube-live/" + uuid.NewString() + "/reused.jpg"
			thumbErr = h.storage.Upload(ctx, key, bytes.NewReader(data), "image/jpeg")
			if thumbErr == nil {
				source.ThumbnailKey = key
			}
		}
		if thumbErr != nil {
			warning = "Details copied. The previous thumbnail could not be copied; generate or upload one before approval."
		}
	}
	draft, err := h.repo.Copy(ctx, scope, source)
	if err != nil {
		return liveError(c, err)
	}
	return utils.CreatedResponse(c, fiber.Map{"draft": draft, "preferences": previous.Preferences, "warning": warning})
}
