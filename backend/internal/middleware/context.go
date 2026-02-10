package middleware

import (
	"strconv"

	"creati.in/creati/backend/internal/types"
	"github.com/gofiber/fiber/v2"
)

// GetContext extracts common parameters from the Fiber context
func GetContext(c *fiber.Ctx) types.UserContext {
	ctx := types.UserContext{
		UserID: GetUserID(c),
	}

	// Extract ClientID from query
	if cidStr := c.Query("clientId"); cidStr != "" {
		if cid, err := strconv.Atoi(cidStr); err == nil {
			ctx.ClientID = &cid
		}
	}

	// Extract OrgID from locals (if set by other middleware)
	if orgID, ok := c.Locals("orgID").(int); ok {
		ctx.OrgID = &orgID
	}

	return ctx
}
