package api

import (
	"database/sql"
	"os"
	"time"

	"example.com/creati/backend/internal/db/models"
	"example.com/creati/backend/internal/features"
	"example.com/creati/backend/internal/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

/**
 * Auth API handlers
 * Following Single Responsibility: ONLY handles authentication endpoints
 */

type AuthHandler struct {
	db *sql.DB
}

func NewAuthHandler(db *sql.DB) *AuthHandler {
	return &AuthHandler{db: db}
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token string      `json:"token"`
	User  models.User `json:"user"`
}

// Register handles user registration
func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request body")
	}

	// Validate input
	if req.Email == "" || req.Password == "" {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "email and password required")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to hash password")
	}

	// Start transaction
	tx, err := h.db.Begin()
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error")
	}
	defer tx.Rollback()

	// Insert user
	var userID int
	err = tx.QueryRow(
		"INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
		req.Email, string(hashedPassword),
	).Scan(&userID)

	if err != nil {
		if err.Error() == "pq: duplicate key value violates unique constraint \"users_email_key\"" {
			return utils.ErrorResponse(c, fiber.StatusConflict, "email already exists")
		}
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to create user")
	}

	// Create free subscription
	// Default to 1 month free
	_, err = tx.Exec(`
		INSERT INTO subscriptions (user_id, plan, billing_cycle, status, current_period_end)
		VALUES ($1, $2, 'monthly', 'active', NOW() + INTERVAL '1 month')
	`, userID, features.PlanFree)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to initialize subscription")
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "transaction commit failed")
	}

	// Generate JWT token
	token, err := generateToken(userID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to generate token")
	}

	// Set Cookies
	setAuthCookies(c, token)

	return utils.CreatedResponse(c, AuthResponse{
		User: models.User{
			ID:    userID,
			Email: req.Email,
		},
	})
}

// Login handles user login
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request body")
	}

	// Get user from database
	var user models.User
	err := h.db.QueryRow(
		"SELECT id, email, password_hash FROM users WHERE email = $1",
		req.Email,
	).Scan(&user.ID, &user.Email, &user.PasswordHash)

	if err == sql.ErrNoRows {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "invalid credentials")
	}
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error")
	}

	// Verify password
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "invalid credentials")
	}

	// Generate JWT token
	token, err := generateToken(user.ID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to generate token")
	}

	// Set Cookies
	setAuthCookies(c, token)

	return utils.SuccessResponse(c, AuthResponse{
		User: user,
	}, "login successful")
}

// CheckAuth verifies the current session
func (h *AuthHandler) CheckAuth(c *fiber.Ctx) error {
	// Middleware has already validated the token, we just return the user info
	userID := c.Locals("userID").(int)

	var user models.User
	err := h.db.QueryRow("SELECT id, email FROM users WHERE id = $1", userID).Scan(&user.ID, &user.Email)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusNotFound, "user not found")
	}

	return utils.SuccessResponse(c, AuthResponse{User: user}, "authenticated")
}

// Logout clears the auth cookies
func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	// Clear JWT
	c.Cookie(&fiber.Cookie{
		Name:     "jwt",
		Value:    "",
		Expires:  time.Now().Add(-1 * time.Hour), // Expire immediately
		HTTPOnly: true,
		Secure:   false, // Set to true in production
		SameSite: "Lax",
		Path:     "/",
	})

	// Clear CSRF
	c.Cookie(&fiber.Cookie{
		Name:     "csrf_token",
		Value:    "",
		Expires:  time.Now().Add(-1 * time.Hour),
		HTTPOnly: false,
		Secure:   false,
		SameSite: "Lax",
		Path:     "/",
	})

	return utils.SuccessResponse(c, nil, "logged out")
}

// Helper to set JWT and CSRF cookies
func setAuthCookies(c *fiber.Ctx, token string) {
	// 1. JWT (HttpOnly)
	c.Cookie(&fiber.Cookie{
		Name:     "jwt",
		Value:    token,
		Expires:  time.Now().Add(24 * 7 * time.Hour),
		HTTPOnly: true,
		Secure:   false, // TODO: True in prod
		SameSite: "Lax", // Lax needed for some redirects, strict is better but can be tricky
		Path:     "/",
	})

	// 2. CSRF Token (Readable by JS)
	// In a real app, use a proper CSPRNG. Here using a simple UUID-like approach for MVP.
	csrfToken, _ := generateToken(0)

	c.Cookie(&fiber.Cookie{
		Name:     "csrf_token",
		Value:    csrfToken,
		Expires:  time.Now().Add(24 * 7 * time.Hour),
		HTTPOnly: false, // JS must read this
		Secure:   false,
		SameSite: "Lax",
		Path:     "/",
	})
}

// Helper function to generate JWT token (DRY principle)
func generateToken(userID int) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(time.Hour * 24 * 7).Unix(), // 7 days
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(os.Getenv("JWT_SECRET")))
}
