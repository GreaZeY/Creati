package middleware

import (
	"database/sql"
	"strconv"

	"creati.in/creati/backend/internal/utils"
	"github.com/gofiber/fiber/v2"
)

// TenancyMiddleware enforces workspace-level security and data isolation.
// It ensures that every request is tied to a validated Workspace (Client).
func TenancyMiddleware(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID := GetUserID(c)
		if userID == 0 {
			// This should theoretically not happen if AuthMiddleware is called first,
			// but we check for safety.
			return utils.ErrorResponse(c, fiber.StatusUnauthorized, "unauthorized")
		}

		// 1. Extract Workspace ID from Header or Query fallback
		workspaceIDStr := c.Get("X-Workspace-ID")
		if workspaceIDStr == "" {
			workspaceIDStr = c.Query("clientId")
		}

		// If no workspace provided, we default to "Personal" workspace (clientID = nil)
		// This keeps the app functional for solo creators who haven't moved to an Agency Org yet.
		if workspaceIDStr == "" {
			c.Locals("clientID", nil)
			return c.Next()
		}

		workspaceID, err := strconv.Atoi(workspaceIDStr)
		if err != nil {
			return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid workspace id format")
		}

		// 2. Security Check & Org Discovery
		var orgID int
		query := `
			SELECT tm.org_id
			FROM team_members tm
			JOIN clients cl ON cl.org_id = tm.org_id
			WHERE tm.user_id = $1 AND cl.id = $2 AND tm.status = 'active'
		`
		err = db.QueryRow(query, userID, workspaceID).Scan(&orgID)
		if err == sql.ErrNoRows {
			return utils.ErrorResponse(c, fiber.StatusForbidden, "access denied to this workspace")
		}
		if err != nil {
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "tenancy validation error", err)
		}

		// 3. Inject validated Workspace and Org IDs into locals
		c.Locals("clientID", workspaceID)
		c.Locals("orgID", orgID)

		return c.Next()
	}
}

// GetClientID retrieves the validated client ID from context
func GetClientID(c *fiber.Ctx) *int {
	val := c.Locals("clientID")
	if val == nil {
		return nil
	}
	if id, ok := val.(int); ok {
		return &id
	}
	return nil
}

// GetOrgID retrieves the validated organization ID from context
func GetOrgID(c *fiber.Ctx) *int {
	val := c.Locals("orgID")
	if val == nil {
		// If not set via Tenancy, try to find user's default org
		return nil
	}
	if id, ok := val.(int); ok {
		return &id
	}
	return nil
}
