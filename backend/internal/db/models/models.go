package models

import (
	"encoding/json"
	"time"
)

// User model
type User struct {
	ID           int       `json:"id" db:"id"`
	Email        string    `json:"email" db:"email"`
	PasswordHash string    `json:"-" db:"password_hash"` // Never expose in JSON
	Name         string    `json:"name" db:"name"`
	FirstName    string    `json:"first_name" db:"first_name"`
	LastName     string    `json:"last_name" db:"last_name"`
	PictureURL   string    `json:"picture_url" db:"picture_url"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

// CreatorPreferences model
type CreatorPreferences struct {
	UserID      int    `json:"user_id" db:"user_id"`
	ContentType string `json:"content_type" db:"content_type"`
	Frequency   string `json:"frequency" db:"frequency"`
}

// Organization model (Agency)
type Organization struct {
	ID           int       `json:"id" db:"id"`
	Name         string    `json:"name" db:"name"`
	LogoURL      string    `json:"logo_url" db:"logo_url"`
	PrimaryColor string    `json:"primary_color" db:"primary_color"`
	Subdomain    *string   `json:"subdomain" db:"subdomain"`
	CustomDomain *string   `json:"custom_domain" db:"custom_domain"`
	OwnerID      int       `json:"owner_id" db:"owner_id"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

// Client model (Workspace)
type Client struct {
	ID             int       `json:"id" db:"id"`
	OrgID          int       `json:"org_id" db:"org_id"`
	Name           string    `json:"name" db:"name"`
	Color          string    `json:"color" db:"color"`
	LogoURL        string    `json:"logo_url" db:"logo_url"`
	BrandVoice     string    `json:"brand_voice" db:"brand_voice"`
	TargetAudience string    `json:"target_audience" db:"target_audience"`
	AvoidKeywords  string    `json:"avoid_keywords" db:"avoid_keywords"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
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
	ID             int        `json:"id" db:"id"`
	UserID         int        `json:"user_id" db:"user_id"`
	ClientID       *int       `json:"client_id,omitempty" db:"client_id"` // Nullable for personal workspace
	Platform       string     `json:"platform" db:"platform"`
	AccessToken    string     `json:"-" db:"access_token"`  // Encrypted, never expose
	RefreshToken   string     `json:"-" db:"refresh_token"` // Encrypted, never expose
	Status         string     `json:"status" db:"status"`
	ProfileName    string     `json:"profile_name" db:"profile_name"`
	Email          string     `json:"email" db:"email"`
	WebhookURL     string     `json:"webhook_url,omitempty" db:"webhook_url"`
	PlatformUserID string     `json:"platform_user_id,omitempty" db:"platform_user_id"`
	Handle         string     `json:"handle" db:"handle"`
	ProfilePicture string     `json:"profile_picture" db:"profile_picture"`
	ExpiresAt      *time.Time `json:"expires_at,omitempty" db:"expires_at"`
	ConnectedAt    time.Time  `json:"connected_at" db:"connected_at"`
}

// Video model
type Video struct {
	ID          int       `json:"id" db:"id"`
	UserID      int       `json:"user_id" db:"user_id"`
	ClientID    *int      `json:"client_id,omitempty" db:"client_id"` // Nullable for personal workspace
	Title       string    `json:"title" db:"title"`
	Description string    `json:"description" db:"description"`
	StorageURL  string    `json:"storage_url" db:"storage_url"`
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

// -- Unified Automation Models --

type AutomationRule struct {
	ID              int             `json:"id" db:"id"`
	UserID          int             `json:"user_id" db:"user_id"`
	ClientID        *int            `json:"client_id,omitempty" db:"client_id"`
	Name            string          `json:"name" db:"name"`
	SourceAccountID int             `json:"source_account_id" db:"source_account_id"`
	Action          string          `json:"action" db:"action"` // 'sync' or 'notify'
	TriggerType     string          `json:"trigger_type" db:"trigger_type"`
	Filters         json.RawMessage `json:"filters" db:"filters"`
	Targets         json.RawMessage `json:"targets" db:"targets"`
	Metadata        json.RawMessage `json:"metadata" db:"metadata"`
	IsActive        bool            `json:"is_active" db:"is_active"`
	LastRunAt       *time.Time      `json:"last_run_at,omitempty" db:"last_run_at"`
	CreatedAt       time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at" db:"updated_at"`
}

type AutomationLog struct {
	ID             string    `json:"id" db:"id"`
	RuleID         int       `json:"rule_id" db:"rule_id"`
	ContentID      int       `json:"content_id" db:"content_id"`
	TargetPlatform string    `json:"target_platform" db:"target_platform"`
	Status         string    `json:"status" db:"status"`
	ErrorMessage   *string   `json:"error_message,omitempty" db:"error_message"`
	RetryCount     int       `json:"retry_count" db:"retry_count"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

type UnifiedTarget struct {
	AccountID        int    `json:"accountId"`
	CaptionTemplate  string `json:"captionTemplate"`
	TitleTemplate    string `json:"titleTemplate"`
	TargetPlatform   string `json:"targetPlatform"`
	TargetIdentifier string `json:"targetIdentifier"`
}

// -- Agency Pivot Models --

// IntakeToken for client platform connection
type IntakeToken struct {
	ID        int        `json:"id" db:"id"`
	UserID    int        `json:"user_id" db:"user_id"` // Agency user who generated the link
	ClientID  int        `json:"client_id" db:"client_id"`
	Token     string     `json:"token" db:"token"`
	ExpiresAt time.Time  `json:"expires_at" db:"expires_at"`
	UsedAt    *time.Time `json:"used_at,omitempty" db:"used_at"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
}

// ApprovalLink for client post/video approvals
type ApprovalLink struct {
	ID        int        `json:"id" db:"id"`
	VideoID   int        `json:"video_id" db:"video_id"`
	Token     string     `json:"token" db:"token"`
	ExpiresAt time.Time  `json:"expires_at" db:"expires_at"`
	Decision  *string    `json:"decision,omitempty" db:"decision"` // 'approved', 'rejected'
	Feedback  string     `json:"feedback,omitempty" db:"feedback"`
	UsedAt    *time.Time `json:"used_at,omitempty" db:"used_at"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
}

// CalendarEntry represents a scheduled post entry for the global calendar
type CalendarEntry struct {
	ID              string     `json:"id"`
	ContentID       string     `json:"contentId"`
	Platform        string     `json:"platform"`
	Status          string     `json:"status"`
	ScheduledAt     *time.Time `json:"scheduledAt"`
	ScheduledStatus string     `json:"scheduledStatus"`
	Title           string     `json:"title"`
	ClientID        int        `json:"clientId"`
	ClientName      string     `json:"clientName"`
	ClientColor     string     `json:"clientColor"`
}

// VideoComment model for agency/client collaboration
type VideoComment struct {
	ID         int       `json:"id" db:"id"`
	VideoID    int       `json:"videoId" db:"video_id"`
	ClientID   *int      `json:"clientId,omitempty" db:"client_id"` // Nullable if from agency directly
	UserID     *int      `json:"userId,omitempty" db:"user_id"`     // Nullable if from client directly
	Content    string    `json:"content" db:"content"`
	IsInternal bool      `json:"isInternal" db:"is_internal"` // Comments only visible to agency team
	CreatedAt  time.Time `json:"createdAt" db:"created_at"`
}
