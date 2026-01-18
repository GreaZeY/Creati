package services

import "github.com/creati/backend/internal/db/models"

/**
 * Platform interface - the contract all platforms must implement
 * Following Interface Segregation and Dependency Inversion principles
 * 
 * Adding a new platform ONLY requires:
 * 1. Creating a new struct that implements this interface
 * 2. Registering it in the platform factory
 */
type Platform interface {
	// Authenticate handles OAuth flow and stores tokens
	Authenticate(code string, userID int) error

	// Upload uploads a video to the platform
	// Returns platform-specific video ID
	Upload(video *models.Video) (platformVideoID string, err error)

	// GetStatus retrieves current upload/processing status from platform
	GetStatus(platformVideoID string) (status string, err error)

	// FetchAnalytics retrieves analytics data from platform
	// Returns view count, engagement metrics, etc.
	FetchAnalytics(platformVideoID string) (analytics *Analytics, err error)
}

// Analytics struct - standardized across platforms
type Analytics struct {
	Views        int64 `json:"views"`
	Likes        int64 `json:"likes"`
	Comments     int64 `json:"comments"`
	Shares       int64 `json:"shares"`
	watchTimeMin int64 `json:"watch_time_minutes"`
}

// VideoUploadRequest - standardized upload request
type VideoUploadRequest struct {
	Title       string
	Description string
	FilePath    string // S3 URL or local path
	Privacy     string // public, unlisted, private
}
