package services

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"GreaZeY/Creati/backend/internal/db/models"
)

type IntakeService struct {
	db *sql.DB
}

func NewIntakeService(db *sql.DB) *IntakeService {
	return &IntakeService{db: db}
}

// GenerateIntakeToken creates a new secure token for a client to connect their accounts
func (s *IntakeService) GenerateIntakeToken(ctx context.Context, userID int, clientID int, expiry time.Duration) (string, error) {
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", fmt.Errorf("failed to generate random token: %w", err)
	}
	token := hex.EncodeToString(tokenBytes)

	expiresAt := time.Now().Add(expiry)

	_, err := s.db.ExecContext(ctx,
		"INSERT INTO intake_tokens (user_id, client_id, token, expires_at) VALUES ($1, $2, $3, $4)",
		userID, clientID, token, expiresAt,
	)
	if err != nil {
		return "", fmt.Errorf("failed to store intake token: %w", err)
	}

	return token, nil
}

// ValidateIntakeToken checks if a token is valid and returns the associated UserID and ClientID
func (s *IntakeService) ValidateIntakeToken(ctx context.Context, token string) (int, int, error) {
	var userID, clientID int
	var expiresAt time.Time
	var usedAt *time.Time

	err := s.db.QueryRowContext(ctx,
		"SELECT user_id, client_id, expires_at, used_at FROM intake_tokens WHERE token = $1",
		token,
	).Scan(&userID, &clientID, &expiresAt, &usedAt)

	if err == sql.ErrNoRows {
		return 0, 0, errors.New("invalid token")
	}
	if err != nil {
		return 0, 0, fmt.Errorf("failed to query token: %w", err)
	}

	if usedAt != nil {
		return 0, 0, errors.New("token already used")
	}

	if time.Now().After(expiresAt) {
		return 0, 0, errors.New("token expired")
	}

	return userID, clientID, nil
}

// MarkTokenAsUsed marks the token as used so it cannot be reused
func (s *IntakeService) MarkTokenAsUsed(ctx context.Context, token string) error {
	_, err := s.db.ExecContext(ctx,
		"UPDATE intake_tokens SET used_at = CURRENT_TIMESTAMP WHERE token = $1",
		token,
	)
	if err != nil {
		return fmt.Errorf("failed to mark token as used: %w", err)
	}
	return nil
}

// GetClientContext (Helper for AI/UI) returns brand meta for a client
func (s *IntakeService) GetClientContext(ctx context.Context, clientID int) (*models.Client, error) {
	var c models.Client
	err := s.db.QueryRowContext(ctx,
		"SELECT id, org_id, name, color, logo_url, brand_voice, target_audience, avoid_keywords, created_at FROM clients WHERE id = $1",
		clientID,
	).Scan(&c.ID, &c.OrgID, &c.Name, &c.Color, &c.LogoURL, &c.BrandVoice, &c.TargetAudience, &c.AvoidKeywords, &c.CreatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to get client context: %w", err)
	}
	return &c, nil
}
