package api

import (
	"creati.in/creati/backend/internal/middleware"
	"creati.in/creati/backend/internal/utils"
	"github.com/gofiber/fiber/v2"
)

func (h *AutomationHandler) CancelExecution(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	executionID := c.Params("id")

	// Update status to cancelled if it's currently queued
	result, err := h.db.Exec(`
		UPDATE automation_executions e
		SET status = 'cancelled', updated_at = NOW()
		FROM automation_rules r
		WHERE e.rule_id = r.id 
		AND (e.id::text = $1 OR e.trace_id::text = $1) 
		AND r.user_id = $2
		AND e.status = 'queued'
	`, executionID, userID)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to cancel execution", err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "execution not found or not in queued state")
	}

	return utils.SuccessResponse(c, nil, "Execution cancelled")
}

func (h *AutomationHandler) PauseExecution(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	executionID := c.Params("id")

	// Update status to paused if it's currently queued
	result, err := h.db.Exec(`
		UPDATE automation_executions e
		SET status = 'paused', updated_at = NOW()
		FROM automation_rules r
		WHERE e.rule_id = r.id 
		AND (e.id::text = $1 OR e.trace_id::text = $1) 
		AND r.user_id = $2
		AND e.status = 'queued'
	`, executionID, userID)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to pause execution", err)
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "execution not found or not in queued state")
	}

	return utils.SuccessResponse(c, nil, "Execution paused")
}
