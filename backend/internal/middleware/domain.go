package middleware

import (
	"database/sql"
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// DomainMiddleware resolves the organization ID based on the request's hostname
// for white-label support. It is intentionally non-blocking — any resolution
// failure simply passes through to the next handler so core routes like
// /auth/login are never affected.
func DomainMiddleware(db *sql.DB) fiber.Handler {
	mainDomain := os.Getenv("MAIN_DOMAIN") // e.g., "creati.in"
	if mainDomain == "" {
		mainDomain = "localhost"
	}

	return func(c *fiber.Ctx) error {
		host := c.Hostname()

		// Skip white-label resolution for the main domain, localhost, or any IP address
		if host == mainDomain ||
			host == "localhost" ||
			strings.HasPrefix(host, "127.") ||
			strings.HasPrefix(host, "192.168.") ||
			strings.HasPrefix(host, "10.") ||
			strings.HasPrefix(host, "[::") || // IPv6
			strings.Contains(host, ":") { // host:port on localhost
			return c.Next()
		}

		// Determine query type (subdomain vs custom domain)
		var orgID int
		var query string
		var arg interface{}

		if strings.HasSuffix(host, "."+mainDomain) {
			subdomain := strings.TrimSuffix(host, "."+mainDomain)
			query = "SELECT id FROM organizations WHERE subdomain = $1"
			arg = subdomain
		} else {
			query = "SELECT id FROM organizations WHERE custom_domain = $1"
			arg = host
		}

		err := db.QueryRow(query, arg).Scan(&orgID)
		if err != nil {
			// No match or any DB error — pass through silently.
			// White-labeling is optional; it must never block core routes.
			return c.Next()
		}

		// Store orgID in locals for handlers that support white-labeling
		c.Locals("orgID", orgID)
		c.Locals("isWhiteLabeled", true)

		return c.Next()
	}
}
