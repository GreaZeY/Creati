package services

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

// FingerprintService generates deterministic content fingerprints
type FingerprintService struct{}

// NewFingerprintService creates a new fingerprinting service
func NewFingerprintService() *FingerprintService {
	return &FingerprintService{}
}

// Generate creates a deterministic fingerprint for content
// Uses platform + content ID + title + duration for fast, reliable identity
func (f *FingerprintService) Generate(
	platform string,
	platformContentID string,
	title string,
	durationSeconds int,
) string {
	// Combine metadata into canonical string
	data := fmt.Sprintf("%s|%s|%s|%d",
		platform,
		platformContentID,
		title,
		durationSeconds,
	)

	// Generate SHA-256 hash
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

// GenerateFromVideo creates fingerprint from video metadata
func (f *FingerprintService) GenerateFromVideo(
	platform string,
	platformContentID string,
	title string,
) string {
	// Simplified version without duration (for cases where it's unknown)
	data := fmt.Sprintf("%s|%s|%s",
		platform,
		platformContentID,
		title,
	)

	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}
