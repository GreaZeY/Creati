package middleware

import (
	"os"
	"strings"

	"example.com/creati/backend/internal/utils"

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
func AuthMiddleware(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "missing authorization header")
	}

	// Extract token from "Bearer <token>"
	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "invalid authorization format")
	}

	tokenString := parts[1]

	// Parse and validate token
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(os.Getenv("JWT_SECRET")), nil
	})

	if err != nil || !token.Valid {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "invalid token")
	}

	// Extract claims and set in context
	if claims, ok := token.Claims.(*Claims); ok {
		c.Locals("userID", claims.UserID)
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
