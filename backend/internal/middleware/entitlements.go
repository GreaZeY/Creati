package middleware

import (
	"database/sql"

	"creati.in/creati/backend/internal/features"
	"creati.in/creati/backend/internal/utils"
	"github.com/gofiber/fiber/v2"
)

// RequireFeature returns a middleware that checks if the user has access to a specific feature
func RequireFeature(db *sql.DB, capability features.Capability) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID := GetUserID(c)
		if userID == 0 {
			return utils.ErrorResponse(c, fiber.StatusUnauthorized, "authentication required")
		}

		// Fetch user's current plan
		var plan string
		err := db.QueryRow(`
			SELECT plan 
			FROM subscriptions 
			WHERE user_id = $1 AND status = 'active'
		`, userID).Scan(&plan)

		if err == sql.ErrNoRows {
			// No subscription found, default to free
			plan = features.PlanFree
		} else if err != nil {
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error")
		}

		// Check if plan has the required feature
		if !features.HasFeature(plan, capability) {
			return utils.ErrorResponse(c, fiber.StatusForbidden, "upgrade required to access this feature")
		}

		return c.Next()
	}
}

// RequireLimit returns a middleware that checks if user is within their usage limit
func RequireLimit(db *sql.DB, capability features.Capability, getCurrentUsage func(int) (int, error)) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID := GetUserID(c)
		if userID == 0 {
			return utils.ErrorResponse(c, fiber.StatusUnauthorized, "authentication required")
		}

		// Fetch user's current plan
		var plan string
		err := db.QueryRow(`
			SELECT plan 
			FROM subscriptions 
			WHERE user_id = $1 AND status = 'active'
		`, userID).Scan(&plan)

		if err == sql.ErrNoRows {
			plan = features.PlanFree
		} else if err != nil {
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error")
		}

		// Get the limit for this plan
		limit := features.GetLimit(plan, capability)

		// If limit is -1 (unlimited), allow
		if limit == -1 {
			return c.Next()
		}

		// Get current usage
		usage, err := getCurrentUsage(userID)
		if err != nil {
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to check usage")
		}

		// Check if over limit
		if usage >= limit {
			return utils.ErrorResponse(c, fiber.StatusForbidden, "usage limit exceeded - upgrade to continue")
		}

		return c.Next()
	}
}
