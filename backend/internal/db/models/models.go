package models

import "time"

// User model
type User struct {
	ID           int       `json:"id" db:"id"`
	Email        string    `json:"email" db:"email"`
	PasswordHash string    `json:"-" db:"password_hash"` // Never expose in JSON
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

// CreatorPreferences model
type CreatorPreferences struct {
	UserID      int    `json:"user_id" db:"user_id"`
	ContentType string `json:"content_type" db:"content_type"`
	Frequency   string `json:"frequency" db:"frequency"`
}

// Organization model (Agency)
type Organization struct {
	ID        int       `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	OwnerID   int       `json:"owner_id" db:"owner_id"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// Client model (Workspace)
type Client struct {
	ID        int       `json:"id" db:"id"`
	OrgID     int       `json:"org_id" db:"org_id"`
	Name      string    `json:"name" db:"name"`
	Color     string    `json:"color" db:"color"`
	LogoURL   string    `json:"logo_url" db:"logo_url"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// TeamMember model
type TeamMember struct {
	ID        int       `json:"id" db:"id"`
	OrgID     int       `json:"org_id" db:"org_id"`
	UserID    int       `json:"user_id" db:"user_id"`
	Role      string    `json:"role" db:"role"`     // 'owner', 'admin', 'editor', 'viewer'
	Status    string    `json:"status" db:"status"` // 'active', 'invited'
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// PlatformAccount model
type PlatformAccount struct {
	ID             int       `json:"id" db:"id"`
	UserID         int       `json:"user_id" db:"user_id"`
	ClientID       *int      `json:"client_id,omitempty" db:"client_id"` // Nullable for personal workspace
	Platform       string    `json:"platform" db:"platform"`
	AccessToken    string    `json:"-" db:"access_token"`  // Encrypted, never expose
	RefreshToken   string    `json:"-" db:"refresh_token"` // Encrypted, never expose
	Status         string    `json:"status" db:"status"`
	ProfileName    string    `json:"profile_name" db:"profile_name"`
	Email          string    `json:"email" db:"email"`
	WebhookURL     string    `json:"webhook_url,omitempty" db:"webhook_url"`
	PlatformUserID string    `json:"platform_user_id,omitempty" db:"platform_user_id"`
	Handle         string    `json:"handle" db:"handle"`
	ConnectedAt    time.Time `json:"connected_at" db:"connected_at"`
}

// Video model
type Video struct {
	ID          int       `json:"id" db:"id"`
	UserID      int       `json:"user_id" db:"user_id"`
	ClientID    *int      `json:"client_id,omitempty" db:"client_id"` // Nullable for personal workspace
	Title       string    `json:"title" db:"title"`
	Description string    `json:"description" db:"description"`
	S3URL       string    `json:"s3_url" db:"s3_url"`
	Status      string    `json:"status" db:"status"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// VideoPlatformJob model
type VideoPlatformJob struct {
	ID         int       `json:"id" db:"id"`
	VideoID    int       `json:"video_id" db:"video_id"`
	Platform   string    `json:"platform" db:"platform"`
	Status     string    `json:"status" db:"status"`
	PlatformID string    `json:"platform_id,omitempty" db:"platform_id"` // Platform's video ID after upload
	RetryCount int       `json:"retry_count" db:"retry_count"`
	ErrorMsg   string    `json:"error_msg,omitempty" db:"error_msg"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

// Job statuses
const (
	JobStatusPending    = "pending"
	JobStatusProcessing = "processing"
	JobStatusCompleted  = "completed"
	JobStatusFailed     = "failed"
)

// VideoAnalytics model
type VideoAnalytics struct {
	ID               int       `json:"id" db:"id"`
	VideoID          int       `json:"video_id" db:"video_id"`
	Platform         string    `json:"platform" db:"platform"`
	Views            int64     `json:"views" db:"views"`
	Likes            int64     `json:"likes" db:"likes"`
	Comments         int64     `json:"comments" db:"comments"`
	Shares           int64     `json:"shares" db:"shares"`
	WatchTimeMinutes int64     `json:"watchTimeMinutes" db:"watch_time_minutes"`
	FetchedAt        time.Time `json:"fetchedAt" db:"fetched_at"`
}
