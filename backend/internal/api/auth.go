package api

import (
	"database/sql"
	"os"
	"time"

	"creati.in/creati/backend/internal/db/models"
	"creati.in/creati/backend/internal/features"
	"creati.in/creati/backend/internal/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/api/idtoken"
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
	Email     string `json:"email"`
	Password  string `json:"password"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
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
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to hash password", err)
	}

	// Start transaction
	tx, err := h.db.Begin()
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error", err)
	}
	defer tx.Rollback()

	// Insert user
	var userID int
	fullName := req.FirstName + " " + req.LastName
	err = tx.QueryRow(
		"INSERT INTO users (email, password_hash, name, first_name, last_name, picture_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
		req.Email, string(hashedPassword), fullName, req.FirstName, req.LastName, "",
	).Scan(&userID)

	if err != nil {
		if err.Error() == "pq: duplicate key value violates unique constraint \"users_email_key\"" {
			return utils.ErrorResponse(c, fiber.StatusConflict, "email already exists", err)
		}
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to create user", err)
	}

	// Create free subscription
	// Default to 1 month free
	_, err = tx.Exec(`
		INSERT INTO subscriptions (user_id, plan, billing_cycle, status, current_period_end)
		VALUES ($1, $2, 'monthly', 'active', NOW() + INTERVAL '1 month')
	`, userID, features.PlanFree)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to initialize subscription", err)
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "transaction commit failed", err)
	}

	// Generate JWT token
	token, err := generateToken(userID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to generate token", err)
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

type GoogleLoginRequest struct {
	IDToken   string `json:"idToken"`
	FirstName string `json:"firstName,omitempty"`
	LastName  string `json:"lastName,omitempty"`
}

// GoogleLogin handles Google OAuth login/registration
func (h *AuthHandler) GoogleLogin(c *fiber.Ctx) error {
	var req GoogleLoginRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request body")
	}

	// 1. Verify Google ID Token
	// Using the client ID from environment
	payload, err := idtoken.Validate(c.Context(), req.IDToken, os.Getenv("GOOGLE_CLIENT_ID"))
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "invalid google token", err)
	}

	email := payload.Claims["email"].(string)
	name := payload.Claims["name"].(string)
	firstName, _ := payload.Claims["given_name"].(string)
	lastName, _ := payload.Claims["family_name"].(string)
	picture, _ := payload.Claims["picture"].(string)

	// User-provided names take precedence if provided (e.g. from signup form)
	if req.FirstName != "" {
		firstName = req.FirstName
	}
	if req.LastName != "" {
		lastName = req.LastName
	}

	// 2. Check if user exists, otherwise create
	var user models.User
	err = h.db.QueryRow(`
		SELECT id, email, name, first_name, last_name, picture_url 
		FROM users WHERE email = $1
	`, email).Scan(&user.ID, &user.Email, &user.Name, &user.FirstName, &user.LastName, &user.PictureURL)

	if err == sql.ErrNoRows {
		// Create new user
		tx, err := h.db.Begin()
		if err != nil {
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error", err)
		}
		defer tx.Rollback()

		err = tx.QueryRow(`
			INSERT INTO users (email, name, first_name, last_name, picture_url) 
			VALUES ($1, $2, $3, $4, $5) RETURNING id
		`, email, name, firstName, lastName, picture).Scan(&user.ID)

		if err != nil {
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to create user", err)
		}

		// Create free subscription
		_, err = tx.Exec(`
			INSERT INTO subscriptions (user_id, plan, billing_cycle, status, current_period_end)
			VALUES ($1, $2, 'monthly', 'active', NOW() + INTERVAL '1 month')
		`, user.ID, features.PlanFree)

		if err != nil {
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to initialize subscription", err)
		}

		if err := tx.Commit(); err != nil {
			return utils.ErrorResponse(c, fiber.StatusInternalServerError, "commit failed", err)
		}

		user.Email = email
		user.Name = name
		user.FirstName = firstName
		user.LastName = lastName
		user.PictureURL = picture
	} else if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error", err)
	} else {
		// Update existing user's name/picture if they just came from Google (optional improvement)
		_, _ = h.db.Exec(`
			UPDATE users SET name = $1, picture_url = $2 WHERE id = $3 AND (name = '' OR picture_url = '')
		`, name, picture, user.ID)
	}

	// 3. Generate JWT and return
	token, err := generateToken(user.ID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to generate token", err)
	}

	setAuthCookies(c, token)

	return utils.SuccessResponse(c, AuthResponse{
		User: user,
	}, "google login successful")
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
		"SELECT id, email, password_hash, name, first_name, last_name, picture_url FROM users WHERE email = $1",
		req.Email,
	).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Name, &user.FirstName, &user.LastName, &user.PictureURL)

	if err == sql.ErrNoRows {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "invalid credentials")
	}
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "database error", err)
	}

	// Verify password
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "invalid credentials")
	}

	// Generate JWT token
	token, err := generateToken(user.ID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to generate token", err)
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
	err := h.db.QueryRow(`
		SELECT id, email, name, first_name, last_name, picture_url FROM users WHERE id = $1
	`, userID).Scan(&user.ID, &user.Email, &user.Name, &user.FirstName, &user.LastName, &user.PictureURL)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusNotFound, "user not found")
	}

	return utils.SuccessResponse(c, AuthResponse{User: user}, "authenticated")
}

type UpdateProfileRequest struct {
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Name      string `json:"name"`
	Picture   string `json:"picture_url"`
}

// UpdateProfile handles updating user profile information
func (h *AuthHandler) UpdateProfile(c *fiber.Ctx) error {
	userID := c.Locals("userID").(int)
	var req UpdateProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "invalid request body")
	}

	_, err := h.db.Exec(`
		UPDATE users SET name = $1, first_name = $2, last_name = $3, picture_url = $4, updated_at = NOW()
		WHERE id = $5
	`, req.Name, req.FirstName, req.LastName, req.Picture, userID)

	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "failed to update profile", err)
	}

	return utils.SuccessResponse(c, nil, "profile updated successfully")
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
