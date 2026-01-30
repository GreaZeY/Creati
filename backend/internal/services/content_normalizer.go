package services

import (
	"context"
	"database/sql"
	"fmt"

	"creati.in/creati/backend/internal/logger"
	"github.com/sirupsen/logrus"
)

// ContentNormalizer handles content identity normalization and deduplication
type ContentNormalizer struct {
	db          *sql.DB
	fingerprint *FingerprintService
}

// NewContentNormalizer creates a new content normalizer
func NewContentNormalizer(db *sql.DB) *ContentNormalizer {
	return &ContentNormalizer{
		db:          db,
		fingerprint: NewFingerprintService(),
	}
}

// NormalizedContent represents the result of content normalization
type NormalizedContent struct {
	ContentID string
	IsNew     bool
}

// NormalizeContent ensures content has a canonical identity
// Returns the content ID and whether it's newly created
func (cn *ContentNormalizer) NormalizeContent(
	ctx context.Context,
	platform string,
	platformContentID string,
	accountID int,
	title string,
	description string,
	durationSeconds int,
	s3Key string,
) (*NormalizedContent, error) {
	// Handle optional account ID (0 means NULL)
	dbAccountID := sql.NullInt64{Int64: int64(accountID), Valid: accountID != 0}

	// Generate fingerprint
	fp := cn.fingerprint.Generate(platform, platformContentID, title, durationSeconds)

	logger.Get("normalizer").WithFields(logrus.Fields{
		"platform":    platform,
		"content_id":  platformContentID,
		"fingerprint": fp[:16] + "...",
	}).Debug("Normalizing content")

	// Try to find existing content by fingerprint
	var existingID string
	err := cn.db.QueryRowContext(ctx, `
		SELECT id FROM contents WHERE fingerprint = $1
	`, fp).Scan(&existingID)

	if err == nil {
		// Content exists - add platform reference if not already present
		logger.Get("normalizer").WithField("content_id", existingID).Info("Found existing content")

		_, err = cn.db.ExecContext(ctx, `
			INSERT INTO platform_contents 
			(content_id, platform, platform_content_id, account_id, s3_key, published_at)
			VALUES ($1, $2, $3, $4, $5, NOW())
			ON CONFLICT (content_id, platform) DO UPDATE
			SET platform_content_id = EXCLUDED.platform_content_id,
			    account_id = EXCLUDED.account_id,
			    s3_key = EXCLUDED.s3_key
		`, existingID, platform, platformContentID, dbAccountID, s3Key)

		if err != nil {
			return nil, fmt.Errorf("failed to update platform reference: %w", err)
		}

		return &NormalizedContent{
			ContentID: existingID,
			IsNew:     false,
		}, nil
	}

	// Content doesn't exist - create new
	logger.Get("normalizer").Info("Creating new content record")

	var contentID string
	err = cn.db.QueryRowContext(ctx, `
		INSERT INTO contents 
		(fingerprint, origin_platform, origin_platform_content_id, title, description, duration_seconds)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`, fp, platform, platformContentID, title, description, durationSeconds).Scan(&contentID)

	if err != nil {
		return nil, fmt.Errorf("failed to create content: %w", err)
	}

	// Add platform reference
	_, err = cn.db.ExecContext(ctx, `
		INSERT INTO platform_contents 
		(content_id, platform, platform_content_id, account_id, s3_key, published_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
	`, contentID, platform, platformContentID, dbAccountID, s3Key)

	if err != nil {
		return nil, fmt.Errorf("failed to create platform reference: %w", err)
	}

	logger.Get("normalizer").WithField("content_id", contentID).Info("Created new content")

	return &NormalizedContent{
		ContentID: contentID,
		IsNew:     true,
	}, nil
}

// GetContentByPlatform retrieves content ID by platform reference
func (cn *ContentNormalizer) GetContentByPlatform(
	ctx context.Context,
	platform string,
	platformContentID string,
) (string, error) {
	var contentID string
	err := cn.db.QueryRowContext(ctx, `
		SELECT content_id 
		FROM platform_contents 
		WHERE platform = $1 AND platform_content_id = $2
	`, platform, platformContentID).Scan(&contentID)

	if err != nil {
		return "", err
	}

	return contentID, nil
}

// CheckCycle verifies if posting to target platform would create a cycle
func (cn *ContentNormalizer) CheckCycle(
	ctx context.Context,
	contentID string,
	targetPlatform string,
) (bool, error) {
	var exists bool
	err := cn.db.QueryRowContext(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM platform_contents
			WHERE content_id = $1 AND platform = $2
		)
	`, contentID, targetPlatform).Scan(&exists)

	return exists, err
}
