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

type ApprovalService struct {
	db *sql.DB
}

func NewApprovalService(db *sql.DB) *ApprovalService {
	return &ApprovalService{db: db}
}

// GenerateApprovalLink creates a magic link for a client to approve a video
func (s *ApprovalService) GenerateApprovalLink(ctx context.Context, videoID int, expiry time.Duration) (string, error) {
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", fmt.Errorf("failed to generate random token: %w", err)
	}
	token := hex.EncodeToString(tokenBytes)

	expiresAt := time.Now().Add(expiry)

	_, err := s.db.ExecContext(ctx,
		"INSERT INTO approval_links (video_id, token, expires_at) VALUES ($1, $2, $3)",
		videoID, token, expiresAt,
	)
	if err != nil {
		return "", fmt.Errorf("failed to store approval token: %w", err)
	}

	// Also mark video as pending_approval
	_, err = s.db.ExecContext(ctx, "UPDATE videos SET status = 'pending_approval' WHERE id = $1", videoID)
	if err != nil {
		return "", fmt.Errorf("failed to update video status: %w", err)
	}

	return token, nil
}

// ValidateApprovalToken validates the token and returns video info
func (s *ApprovalService) ValidateApprovalToken(ctx context.Context, token string) (*models.Video, error) {
	var videoID int
	var expiresAt time.Time

	err := s.db.QueryRowContext(ctx,
		"SELECT video_id, expires_at FROM approval_links WHERE token = $1",
		token,
	).Scan(&videoID, &expiresAt)

	if err == sql.ErrNoRows {
		return nil, errors.New("invalid approval link")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query approval link: %w", err)
	}

	if time.Now().After(expiresAt) {
		return nil, errors.New("approval link expired")
	}

	// Get video details
	var v models.Video
	err = s.db.QueryRowContext(ctx,
		"SELECT id, user_id, client_id, title, description, storage_url, status, created_at FROM videos WHERE id = $1",
		videoID,
	).Scan(&v.ID, &v.UserID, &v.ClientID, &v.Title, &v.Description, &v.StorageURL, &v.Status, &v.CreatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to get video details: %w", err)
	}

	return &v, nil
}

// SubmitDecision records the client's decision on the content
func (s *ApprovalService) SubmitDecision(ctx context.Context, token string, decision string, feedback string) error {
	if decision != "approved" && decision != "rejected" {
		return errors.New("invalid decision")
	}

	var videoID int
	err := s.db.QueryRowContext(ctx, "SELECT video_id FROM approval_links WHERE token = $1", token).Scan(&videoID)
	if err != nil {
		return fmt.Errorf("failed to get video from token: %w", err)
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Update approval link
	_, err = tx.ExecContext(ctx,
		"UPDATE approval_links SET decision = $1, feedback = $2, used_at = CURRENT_TIMESTAMP WHERE token = $3",
		decision, feedback, token,
	)
	if err != nil {
		return err
	}

	// Update video status
	newStatus := "approved"
	if decision == "rejected" {
		newStatus = "rejected"
	}

	_, err = tx.ExecContext(ctx, "UPDATE videos SET status = $1 WHERE id = $2", newStatus, videoID)
	if err != nil {
		return err
	}

	return tx.Commit()
}
