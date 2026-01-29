package middleware

import (
	"os"
	"strings"

	"creati.in/creati/backend/internal/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

/**
 * JWT Authentication Middleware
 * Following Single Responsibility: ONLY handles auth validation
 */

type Claims struct {
	UserID int `json:"user_id"`
	jwt.RegisteredClaims
}

// AuthMiddleware validates JWT token and sets user context
// AuthMiddleware validates JWT token from Cookie and enforces CSRF
func AuthMiddleware(c *fiber.Ctx) error {
	// 1. JWT Validation (from Cookie)
	tokenString := c.Cookies("jwt")
	if tokenString == "" {
		// Fallback to Bearer header for API clients (optional, but good for testing)
		authHeader := c.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenString = strings.TrimPrefix(authHeader, "Bearer ")
		} else {
			return utils.ErrorResponse(c, fiber.StatusUnauthorized, "missing authentication")
		}
	}

	// Parse and validate token
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(os.Getenv("JWT_SECRET")), nil
	})

	if err != nil || !token.Valid {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "invalid or expired session")
	}

	// Extract claims and set in context
	if claims, ok := token.Claims.(*Claims); ok {
		c.Locals("userID", claims.UserID)
	}

	// 2. CSRF Protection (Double Submit Cookie Pattern)
	// Only check on unsafe methods
	method := c.Method()
	if method == "POST" || method == "PUT" || method == "DELETE" || method == "PATCH" {
		csrfCookie := c.Cookies("csrf_token")
		csrfHeader := c.Get("X-CSRF-Token")

		if csrfCookie == "" || csrfHeader == "" || csrfCookie != csrfHeader {
			return utils.ErrorResponse(c, fiber.StatusForbidden, "invalid csrf token")
		}
	}

	return c.Next()
}

// GetUserID retrieves user ID from context (helper function)
func GetUserID(c *fiber.Ctx) int {
	userID, ok := c.Locals("userID").(int)
	if !ok {
		return 0
	}
	return userID
}
