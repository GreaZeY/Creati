package api

import (
	"database/sql"
	"fmt"
	"creati.in/creati/backend/internal/middleware"
	"creati.in/creati/backend/internal/utils"
	"github.com/gofiber/fiber/v2"
)

type AiHandler struct {
	db *sql.DB
}

func NewAiHandler(db *sql.DB) *AiHandler {
	return &AiHandler{db: db}
}

// GetCredits returns the user's current AI credit balance
func (h *AiHandler) GetCredits(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var credits int
	err := h.db.QueryRow("SELECT ai_credits FROM users WHERE id = $1", userID).Scan(&credits)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error", err)
	}

	return utils.SuccessResponse(c, fiber.Map{
		"credits": credits,
	}, "")
}

// GeneratePost handles topic-to-post generation.
// Costs 1 credit.
func (h *AiHandler) GeneratePost(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var req struct {
		Topic    string `json:"topic"`
		Tone     string `json:"tone"`     // Gen Z, professional, casual
		Goal     string `json:"goal"`     // engagement, announcement, promo
		Platform string `json:"platform"` // optional context
	}

	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request body")
	}

	if req.Topic == "" {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "topic is required")
	}

	// 1. Transaction to deduct credit
	tx, err := h.db.Begin()
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error", err)
	}
	defer tx.Rollback()

	var credits int
	err = tx.QueryRow("SELECT ai_credits FROM users WHERE id = $1 FOR UPDATE", userID).Scan(&credits)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error", err)
	}

	if credits < 1 {
		return utils.ErrorResponse(c, fiber.StatusPaymentRequired, "insufficient credits")
	}

	_, err = tx.Exec("UPDATE users SET ai_credits = ai_credits - 1 WHERE id = $1", userID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to deduct credits", err)
	}

	_, err = tx.Exec("INSERT INTO ai_credit_logs (user_id, amount, action) VALUES ($1, -1, 'generation')", userID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to log credit usage", err)
	}

	if err := tx.Commit(); err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to commit transaction", err)
	}

	// 2. Mock AI generation (Replace with LLM service in production)
	mockResponse := fmt.Sprintf("AI Post for %s in %s tone: Check out our new announcement about %s! #%s #vision", req.Platform, req.Tone, req.Topic, req.Goal)

	return utils.SuccessResponse(c, fiber.Map{
		"text":             mockResponse,
		"creditsRemaining": credits - 1,
	}, "Post generated successfully")
}

// RewritePost handles platform-specific rewriting.
// Costs 1 credit.
func (h *AiHandler) RewritePost(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var req struct {
		OriginalText string `json:"originalText"`
		Platform     string `json:"platform"`
		Tone         string `json:"tone"`
	}

	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request body")
	}

	if req.OriginalText == "" || req.Platform == "" {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "originalText and platform are required")
	}

	// 1. Transaction to deduct credit
	tx, err := h.db.Begin()
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error", err)
	}
	defer tx.Rollback()

	var credits int
	err = tx.QueryRow("SELECT ai_credits FROM users WHERE id = $1 FOR UPDATE", userID).Scan(&credits)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error", err)
	}

	if credits < 1 {
		return utils.ErrorResponse(c, fiber.StatusPaymentRequired, "insufficient credits")
	}

	_, err = tx.Exec("UPDATE users SET ai_credits = ai_credits - 1 WHERE id = $1", userID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to deduct credits", err)
	}

	_, err = tx.Exec("INSERT INTO ai_credit_logs (user_id, amount, action) VALUES ($1, -1, 'rewrite')", userID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to log credit usage", err)
	}

	if err := tx.Commit(); err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to commit transaction", err)
	}

	// 2. Mock AI rewrite
	mockResponse := fmt.Sprintf("[%s Optimized] %s (Tone: %s)", req.Platform, req.OriginalText, req.Tone)

	return utils.SuccessResponse(c, fiber.Map{
		"text":             mockResponse,
		"creditsRemaining": credits - 1,
	}, "Post rewritten for "+req.Platform)
}
