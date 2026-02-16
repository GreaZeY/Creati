package services

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"os"

	"creati.in/creati/backend/internal/logger"
)

// MediaService handles centralized media operations: downloading, caching, and serving
type MediaService struct {
	db      *sql.DB
	storage *StorageService
}

const (
	// MaxVideoSize = 500MB
	MaxVideoSize = 500 * 1024 * 1024
)

func NewMediaService(db *sql.DB, storage *StorageService) *MediaService {
	return &MediaService{
		db:      db,
		storage: storage,
	}
}

// EnsureCached ensures a platform video is downloaded to Storage
// Returns the Storage Key
func (s *MediaService) EnsureCached(ctx context.Context, platform string, videoID string) (string, error) {
	// 1. Determine Cache Key
	cacheKey := fmt.Sprintf("cache/%s/%s.mp4", platform, videoID)

	// 2. Check if exists
	exists, err := s.storage.Exists(ctx, cacheKey)
	if err != nil {
		return "", fmt.Errorf("failed to check cache existence: %w", err)
	}
	if exists {
		// Log
		logger.Get("media").WithField("key", cacheKey).Info("Using cached video")
		return cacheKey, nil
	}

	// 3. Download from Platform
	logger.Get("media").WithField("key", cacheKey).Info("Cache miss, downloading video...")

	platformSvc, err := GetPlatformService(platform, s.db)
	if err != nil {
		return "", err
	}

	// Temp file
	tempFile, err := os.CreateTemp("", fmt.Sprintf("media-cache-%s-%s-*.mp4", platform, videoID))
	if err != nil {
		return "", fmt.Errorf("failed to create temp file: %w", err)
	}
	defer os.Remove(tempFile.Name())
	defer tempFile.Close()

	// Download Logic
	downloaded := false
	if hq, ok := platformSvc.(HighQualityDownloader); ok {
		logger.Get("media").WithField("platform", platform).Info("Attempting High Quality Download")
		err := hq.DownloadHighQuality(ctx, videoID, tempFile.Name())
		if err == nil {
			downloaded = true
		} else {
			logger.Get("media").WithError(err).Warn("HQ download failed, falling back to stream")
		}
	}

	if !downloaded {
		stream, _, err := platformSvc.GetStream(ctx, videoID)
		if err != nil {
			return "", fmt.Errorf("failed to get stream: %w", err)
		}
		defer stream.Close()

		// Copy with limit
		// io.LimitedReader stops at N, but doesn't error.
		// We read N+1. If we read N+1 bytes, it's too big.

		written, err := io.Copy(tempFile, io.LimitReader(stream, MaxVideoSize+1))
		if err != nil {
			return "", fmt.Errorf("download failed: %w", err)
		}
		if written > MaxVideoSize {
			return "", fmt.Errorf("video exceeds size limit of 500MB")
		}
	}

	// 4. Upload to Storage
	// Seek to start
	if _, err := tempFile.Seek(0, 0); err != nil {
		return "", err
	}

	// We assume mp4
	if err := s.storage.Upload(ctx, cacheKey, tempFile, "video/mp4"); err != nil {
		return "", fmt.Errorf("failed to upload to cache: %w", err)
	}

	return cacheKey, nil
}

func (s *MediaService) GetStream(ctx context.Context, key string) (io.ReadCloser, error) {
	return s.storage.GetStream(ctx, key)
}
