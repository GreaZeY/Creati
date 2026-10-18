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

		// 1. Resolve Org by Domain (Subdomain/Custom Domain)
		host := c.Hostname()
		var domainOrgID int
		// Check if host is not the main one (hardcoded example, should use config)
		if host != "creati.in" && host != "localhost" && host != "127.0.0.1" {
			err := db.QueryRow(`SELECT id FROM organizations WHERE custom_domain = $1 OR subdomain = $1`, host).Scan(&domainOrgID)
			if err == nil {
				c.Locals("orgID", domainOrgID)
			}
		}

		if userID == 0 {
			// Public portals (Asset Drop, Reports) use token-based auth, so they might skip this
			// but we still want to resolve the Org via domain if possible.
			return c.Next()
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
			SELECT cl.org_id
			FROM clients cl JOIN organizations o ON o.id = cl.org_id
			LEFT JOIN team_members tm ON tm.org_id = o.id AND tm.user_id = $1 AND tm.status = 'active'
			WHERE cl.id = $2 AND (o.owner_id = $1 OR tm.user_id IS NOT NULL)
		`
		err = db.QueryRowContext(c.UserContext(), query, userID, workspaceID).Scan(&orgID)
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
