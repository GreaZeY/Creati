package services

import (
	"context"
	"io"
	"time"

	"creati.in/creati/backend/internal/db/models"
)

/**
 * Platform interface - the contract all platforms must implement
 * Following Interface Segregation and Dependency Inversion principles
 *
 * Adding a new platform ONLY requires:
 * 1. Creating a new struct that implements this interface
 * 2. Registering it in the platform factory
 */
type Platform interface {
	// GetAuthURL returns the OAuth URL for user authorization
	GetAuthURL(state string) string

	// GetAuthURLWithHint returns OAuth URL with optional hint/prompt (used for reconnection)
	GetAuthURLWithHint(state, prompt, loginHint string) string

	// Authenticate handles OAuth flow and stores tokens
	Authenticate(code string, userID int, clientID *int) error

	// Upload uploads a video to the platform for a specific account
	// Returns platform-specific video ID
	Upload(video *models.Video, accountID int) (platformVideoID string, err error)

	// GetStatus retrieves current upload/processing status from platform
	GetStatus(platformVideoID string) (status string, err error)

	// FetchAnalytics retrieves analytics data from platform for a specific account
	// Returns view count, engagement metrics, etc.
	FetchAnalytics(platformVideoID string, accountID int) (analytics *Analytics, err error)

	// FetchRecentVideos retrieves past videos from the platform
	FetchRecentVideos(accountID int) ([]ExternalVideo, error)

	// GetStream returns an io.ReadCloser for the video content
	GetStream(ctx context.Context, platformVideoID string) (io.ReadCloser, string, error)
}

// ExternalVideo - standardized past video info
type ExternalVideo struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Thumbnail   string    `json:"thumbnail"`
	URL         string    `json:"url"`
	PublishedAt time.Time `json:"publishedAt"`
}

// Analytics struct - standardized across platforms
type Analytics struct {
	Views        int64 `json:"views"`
	Likes        int64 `json:"likes"`
	Comments     int64 `json:"comments"`
	Shares       int64 `json:"shares"`
	WatchTimeMin int64 `json:"watch_time_minutes"`
}

// VideoUploadRequest - standardized upload request
type VideoUploadRequest struct {
	Title       string
	Description string
	FilePath    string // S3 URL or local path
	Privacy     string // public, unlisted, private
}
