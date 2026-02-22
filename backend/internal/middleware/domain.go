package middleware

import (
	"database/sql"
	"os"
	"strings"

	"creati.in/creati/backend/internal/utils"
	"github.com/gofiber/fiber/v2"
)

// DomainMiddleware resolves the organization ID based on the request's hostname.
func DomainMiddleware(db *sql.DB) fiber.Handler {
	mainDomain := os.Getenv("MAIN_DOMAIN") // e.g., "creati.in"
	if mainDomain == "" {
		mainDomain = "localhost"
	}

	return func(c *fiber.Ctx) error {
		host := c.Hostname()

		// Skip resolution if it's the main domain or an IP
		if host == mainDomain || host == "localhost" || strings.HasPrefix(host, "127.0.0.1") {
			return c.Next()
		}

		// Check if it's a subdomain (e.g., "agency1.creati.in")
		var orgID int
		var query string
		var arg interface{}

		if strings.HasSuffix(host, "."+mainDomain) {
			subdomain := strings.TrimSuffix(host, "."+mainDomain)
			query = "SELECT id FROM organizations WHERE subdomain = $1"
			arg = subdomain
		} else {
			// Assume it's a custom domain
			query = "SELECT id FROM organizations WHERE custom_domain = $1"
			arg = host
		}

		err := db.QueryRow(query, arg).Scan(&orgID)
		if err != nil {
			if err == sql.ErrNoRows {
				// No workspace found for this domain
				return c.Next()
			}
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "domain resolution failed", err)
		}

		// Store orgID in locals for handlers to use
		c.Locals("orgID", orgID)
		c.Locals("isWhiteLabeled", true)

		return c.Next()
	}
}
