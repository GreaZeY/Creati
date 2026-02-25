package api

import (
	"database/sql"
	"fmt"

	"creati.in/creati/backend/internal/middleware"
	"creati.in/creati/backend/internal/services"
	"creati.in/creati/backend/internal/utils"
	"github.com/gofiber/fiber/v2"
)

type AiHandler struct {
	db          *sql.DB
	chatService *services.ChatService
	aiService   *services.AIService
}

func NewAiHandler(db *sql.DB, chatService *services.ChatService, aiService *services.AIService) *AiHandler {
	return &AiHandler{
		db:          db,
		chatService: chatService,
		aiService:   aiService,
	}
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
		ClientID *int   `json:"clientId"` // To fetch Brand Voice
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

	// 2. Fetch Brand Voice Context
	var brandVoice, targetAudience string
	if req.ClientID != nil {
		var bv, ta sql.NullString
		err := h.db.QueryRow("SELECT brand_voice, target_audience FROM clients WHERE id = $1", *req.ClientID).Scan(&bv, &ta)
		if err == nil {
			if bv.Valid {
				brandVoice = bv.String
			}
			if ta.Valid {
				targetAudience = ta.String
			}
		}
	}

	// 3. Real AI generation
	prompt := fmt.Sprintf("Topic: %s\nTone: %s\nGoal: %s\nPlatform: %s", req.Topic, req.Tone, req.Goal, req.Platform)
	response, err := h.aiService.GenerateCreative(c.Context(), prompt, brandVoice, targetAudience, "")
	if err != nil {
		// Refund credit on failure
		h.db.Exec("UPDATE users SET ai_credits = ai_credits + 1 WHERE id = $1", userID)
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "AI generation failed", err)
	}

	return utils.SuccessResponse(c, fiber.Map{
		"text":             response,
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

	// 2. Real AI rewrite
	prompt := fmt.Sprintf("Rewrite the following text for %s with a %s tone:\n\n%s", req.Platform, req.Tone, req.OriginalText)
	response, err := h.aiService.GenerateCreative(c.Context(), prompt, "", "", "")
	if err != nil {
		h.db.Exec("UPDATE users SET ai_credits = ai_credits + 1 WHERE id = $1", userID)
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "AI rewrite failed", err)
	}

	return utils.SuccessResponse(c, fiber.Map{
		"text":             response,
		"creditsRemaining": credits - 1,
	}, "Post rewritten for "+req.Platform)
}

// Chat handles the main conversation loop with the Creati Agent
func (h *AiHandler) Chat(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var req struct {
		ConversationID *string `json:"conversationId"`
		Message        string  `json:"message"`
	}

	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request body")
	}

	if req.Message == "" {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "message is required")
	}

	result, err := h.chatService.ProcessChat(c.Context(), userID, req.ConversationID, req.Message)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to process chat", err)
	}

	return utils.SuccessResponse(c, result, "")
}

// GenerateCreative handles the /creative-lab/generate endpoint
func (h *AiHandler) GenerateCreative(c *fiber.Ctx) error {
	var req struct {
		Prompt         string `json:"prompt"`
		BrandVoice     string `json:"brandVoice"`
		TargetAudience string `json:"targetAudience"`
		Constraints    string `json:"constraints"`
	}

	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request body")
	}

	if req.Prompt == "" {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "prompt is required")
	}

	// Generate 3 variations using the new AIService
	result, err := h.aiService.GenerateCreative(c.Context(), req.Prompt, req.BrandVoice, req.TargetAudience, req.Constraints)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "ai generation failed", err)
	}

	return utils.SuccessResponse(c, fiber.Map{
		"output": result,
	}, "Variations generated successfully")
}
