package api

import (
	"database/sql"
	"time"

	"creati.in/creati/backend/internal/middleware"
	"creati.in/creati/backend/internal/utils"
	"github.com/gofiber/fiber/v2"
)

type NotificationHandler struct {
	db *sql.DB
}

func NewNotificationHandler(db *sql.DB) *NotificationHandler {
	return &NotificationHandler{db: db}
}

type NotificationResponse struct {
	ID        int       `json:"id"`
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	IsRead    bool      `json:"isRead"`
	CreatedAt time.Time `json:"createdAt"`
}

func (h *NotificationHandler) List(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	rows, err := h.db.QueryContext(c.Context(), `
		SELECT id, title, message, is_read, created_at 
		FROM notifications 
		WHERE user_id = $1 
		ORDER BY created_at DESC 
		LIMIT 50
	`, userID)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to fetch notifications", err)
	}
	defer rows.Close()

	notifications := make([]NotificationResponse, 0)
	for rows.Next() {
		var n NotificationResponse
		if err := rows.Scan(&n.ID, &n.Title, &n.Message, &n.IsRead, &n.CreatedAt); err != nil {
			continue
		}
		notifications = append(notifications, n)
	}

	return utils.SuccessResponse(c, notifications, "")
}

func (h *NotificationHandler) MarkRead(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	id := c.Params("id")

	_, err := h.db.ExecContext(c.Context(), `
		UPDATE notifications SET is_read = TRUE 
		WHERE id = $1 AND user_id = $2
	`, id, userID)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to update notification", err)
	}

	return utils.SuccessResponse(c, nil, "Notification marked as read")
}

func (h *NotificationHandler) MarkAllRead(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	_, err := h.db.ExecContext(c.Context(), `
		UPDATE notifications SET is_read = TRUE 
		WHERE user_id = $1
	`, userID)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to update notifications", err)
	}

	return utils.SuccessResponse(c, nil, "All notifications marked as read")
}
