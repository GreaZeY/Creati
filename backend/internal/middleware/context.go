package middleware

import (
	"creati.in/creati/backend/internal/types"
	"github.com/gofiber/fiber/v2"
)

// GetContext extracts common parameters from the Fiber context.
// Following SOLID: Responsibility is limited to context extraction from transport layer.
func GetContext(c *fiber.Ctx) types.UserContext {
	ctx := types.UserContext{
		UserID: GetUserID(c),
	}

	// Extract IDs from locals (set by TenancyMiddleware)
	ctx.ClientID = GetClientID(c)
	ctx.OrgID = GetOrgID(c)

	return ctx
}
