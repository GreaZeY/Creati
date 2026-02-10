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
	title string,
	description string,
	durationSeconds int,
	s3Key string,
) (*NormalizedContent, error) {

	// 1. Check if this platform content is already linked to a canonical record
	var existingContentID string
	err := cn.db.QueryRowContext(ctx, `
		SELECT content_id FROM platform_contents 
		WHERE platform = $1 AND platform_content_id = $2
	`, platform, platformContentID).Scan(&existingContentID)

	if err == nil {
		// Platform link found - use the existing canonical ID.
		logger.Get("normalizer").WithField("content_id", existingContentID).Debug("Existing platform link found")

		// SYNC-ON-DEMAND: Update metadata while we have it fresh
		// We overwrite if the existing title is empty or a known placeholder
		_, err = cn.db.ExecContext(ctx, `
			UPDATE contents 
			SET title = $1,
			    description = COALESCE(NULLIF(description, ''), $2),
				updated_at = NOW()
			WHERE id = $3 AND (
				title = '' OR title IS NULL OR title = 'Archive Blast Video'
			) AND $1 != '' AND $1 != 'Archive Blast Video'
		`, title, description, existingContentID)

		return &NormalizedContent{
			ContentID: existingContentID,
			IsNew:     false,
		}, nil
	}

	// 2. Not found by platform - generate fingerprint and check for global match
	fp := cn.fingerprint.Generate(platform, platformContentID, title, durationSeconds)

	logger.Get("normalizer").WithFields(logrus.Fields{
		"platform":    platform,
		"content_id":  platformContentID,
		"fingerprint": fp[:16] + "...",
	}).Debug("Normalizing new platform content")

	err = cn.db.QueryRowContext(ctx, `
		SELECT id FROM contents WHERE fingerprint = $1
	`, fp).Scan(&existingContentID)

	if err == nil {
		// Fingerprint matched - link this platform content to the existing canonical record
		logger.Get("normalizer").WithField("content_id", existingContentID).Info("Found global content match by fingerprint")

		_, err = cn.db.ExecContext(ctx, `
			INSERT INTO platform_contents 
			(content_id, platform, platform_content_id, s3_key, published_at)
			VALUES ($1, $2, $3, $4, NOW())
			ON CONFLICT (platform, platform_content_id) DO UPDATE
			SET content_id = EXCLUDED.content_id,
			    s3_key = EXCLUDED.s3_key
		`, existingContentID, platform, platformContentID, s3Key)

		if err != nil {
			return nil, fmt.Errorf("failed to link existing content: %w", err)
		}

		return &NormalizedContent{
			ContentID: existingContentID,
			IsNew:     false,
		}, nil
	}

	// 3. Complete ghost - create new canonical content record
	logger.Get("normalizer").Info("Creating new canonical content record")

	err = cn.db.QueryRowContext(ctx, `
		INSERT INTO contents 
		(fingerprint, origin_platform, origin_platform_content_id, title, description, duration_seconds)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`, fp, platform, platformContentID, title, description, durationSeconds).Scan(&existingContentID)

	if err != nil {
		return nil, fmt.Errorf("failed to create content: %w", err)
	}

	// Add platform reference
	_, err = cn.db.ExecContext(ctx, `
		INSERT INTO platform_contents 
		(content_id, platform, platform_content_id, s3_key, published_at)
		VALUES ($1, $2, $3, $4, NOW())
	`, existingContentID, platform, platformContentID, s3Key)

	if err != nil {
		return nil, fmt.Errorf("failed to create platform reference: %w", err)
	}

	logger.Get("normalizer").WithField("content_id", existingContentID).Info("Created new content")

	return &NormalizedContent{
		ContentID: existingContentID,
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
