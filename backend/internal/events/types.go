package events

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// EventAdapter defines the interface that all platform-specific event adapters must implement.
// This enables platform-agnostic event processing while maintaining separation of concerns.
type EventAdapter interface {
	// ParsePayload converts platform-specific webhook payload to a normalized event
	ParsePayload(raw []byte) (*NormalizedEvent, error)

	// GenerateDedupKey creates a unique key for idempotency checks
	GenerateDedupKey(event *NormalizedEvent) string

	// ValidateSignature verifies the webhook payload signature (if applicable)
	ValidateSignature(payload []byte, signature string, secret string) bool
}

// NormalizedEvent represents a platform event in our internal schema
type NormalizedEvent struct {
	ID          uuid.UUID              `json:"id"`
	Platform    string                 `json:"platform"`    // youtube, instagram, facebook, linkedin
	EventType   string                 `json:"event_type"`  // video_uploaded, media_published, etc.
	ExternalID  string                 `json:"external_id"` // Platform's content ID
	AccountID   int                    `json:"account_id"`  // FK to platform_accounts
	Payload     map[string]interface{} `json:"payload"`     // Original payload for replay/debugging
	OccurredAt  time.Time              `json:"occurred_at"` // When the event happened on the platform
	ReceivedAt  time.Time              `json:"received_at"` // When we received it
	Status      EventStatus            `json:"status"`
	DedupKey    string                 `json:"dedup_key"`
	ProcessedAt *time.Time             `json:"processed_at,omitempty"`
	Error       string                 `json:"error,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
}

// EventStatus represents the processing state of an event
type EventStatus string

const (
	EventStatusPending   EventStatus = "pending"
	EventStatusProcessed EventStatus = "processed"
	EventStatusFailed    EventStatus = "failed"
)

// WebhookSubscription represents an active webhook subscription
type WebhookSubscription struct {
	ID             int        `json:"id"`
	AccountID      int        `json:"account_id"`
	Platform       string     `json:"platform"`
	SubscriptionID string     `json:"subscription_id,omitempty"`
	TopicURL       string     `json:"topic_url"`
	CallbackURL    string     `json:"callback_url"`
	Secret         string     `json:"secret,omitempty"`
	LeaseExpiresAt *time.Time `json:"lease_expires_at,omitempty"`
	Status         string     `json:"status"` // pending, active, expired, failed
	LastVerifiedAt *time.Time `json:"last_verified_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// PollingState tracks the last poll timestamp for platforms without webhooks
type PollingState struct {
	ID             int        `json:"id"`
	AccountID      int        `json:"account_id"`
	LastExternalID string     `json:"last_external_id,omitempty"`
	LastPolledAt   *time.Time `json:"last_polled_at,omitempty"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// GenerateStandardDedupKey creates a consistent deduplication key across all platforms
// Format: SHA256(platform|event_type|external_id)
func GenerateStandardDedupKey(platform, eventType, externalID string) string {
	raw := fmt.Sprintf("%s|%s|%s", platform, eventType, externalID)
	hash := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(hash[:])
}

// NewNormalizedEvent creates a new event with sensible defaults
func NewNormalizedEvent(platform, eventType, externalID string, accountID int, payload map[string]interface{}) *NormalizedEvent {
	now := time.Now()
	event := &NormalizedEvent{
		ID:         uuid.New(),
		Platform:   platform,
		EventType:  eventType,
		ExternalID: externalID,
		AccountID:  accountID,
		Payload:    payload,
		OccurredAt: now,
		ReceivedAt: now,
		Status:     EventStatusPending,
		CreatedAt:  now,
	}
	event.DedupKey = GenerateStandardDedupKey(platform, eventType, externalID)
	return event
}
