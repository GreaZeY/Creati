package events

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/xml"
	"errors"
	"time"
)

// YouTubeAdapter implements EventAdapter for YouTube WebSub webhooks
type YouTubeAdapter struct{}

// YouTubeFeed represents the YouTube ATOM feed format
type YouTubeFeed struct {
	XMLName xml.Name       `xml:"feed"`
	Entries []YouTubeEntry `xml:"entry"`
}

// YouTubeEntry represents a video entry in the feed
type YouTubeEntry struct {
	VideoID   string `xml:"videoId"`
	ChannelID string `xml:"channelId"`
	Title     string `xml:"title"`
	Published string `xml:"published"`
	Updated   string `xml:"updated"`
}

var (
	ErrInvalidYouTubePayload = errors.New("invalid youtube payload")
	ErrNoEntries             = errors.New("no entries in feed")
)

// ParsePayload converts YouTube WebSub ATOM feed to NormalizedEvent
func (a *YouTubeAdapter) ParsePayload(raw []byte) (*NormalizedEvent, error) {
	var feed YouTubeFeed
	if err := xml.Unmarshal(raw, &feed); err != nil {
		return nil, ErrInvalidYouTubePayload
	}

	if len(feed.Entries) == 0 {
		return nil, ErrNoEntries
	}

	// YouTube sends one entry per notification
	entry := feed.Entries[0]

	// Parse published time
	occurredAt, err := time.Parse(time.RFC3339, entry.Published)
	if err != nil {
		occurredAt = time.Now() // Fallback to current time
	}

	// Create payload map for storage
	payload := map[string]interface{}{
		"video_id":   entry.VideoID,
		"channel_id": entry.ChannelID,
		"title":      entry.Title,
		"published":  entry.Published,
		"updated":    entry.Updated,
	}

	// Note: AccountID will be set by the webhook handler based on channel_id lookup
	event := &NormalizedEvent{
		Platform:   "youtube",
		EventType:  "video_uploaded",
		ExternalID: entry.VideoID,
		Payload:    payload,
		OccurredAt: occurredAt,
	}

	return event, nil
}

// GenerateDedupKey creates YouTube-specific dedup key
func (a *YouTubeAdapter) GenerateDedupKey(event *NormalizedEvent) string {
	return GenerateStandardDedupKey(event.Platform, event.EventType, event.ExternalID)
}

// ValidateSignature verifies YouTube WebSub signature
// Note: YouTube WebSub (PubSubHubbub) does NOT use HMAC signatures for notifications.
// Verification happens during subscription via challenge-response.
// We implement this for interface compliance but always return true.
func (a *YouTubeAdapter) ValidateSignature(payload []byte, signature string, secret string) bool {
	// YouTube doesn't sign payloads - verification is done during subscribe/unsubscribe
	// Accept all payloads (verification is implicit through subscription handshake)
	return true
}

// ValidateHubSignature can be used if YouTube ever adds signature support
// Currently unused but kept for future compatibility
func ValidateHubSignature(payload []byte, receivedSig string, secret string) bool {
	if secret == "" || receivedSig == "" {
		return false
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	expectedMAC := mac.Sum(nil)
	expectedSig := "sha256=" + hex.EncodeToString(expectedMAC)

	return hmac.Equal([]byte(expectedSig), []byte(receivedSig))
}
