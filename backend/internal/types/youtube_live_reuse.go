package types

import (
	"fmt"
	"time"
)

type LivePreferences struct {
	AccountID   int    `json:"accountId"`
	Category    string `json:"category"`
	Language    string `json:"language"`
	Visibility  string `json:"visibility"`
	MadeForKids *bool  `json:"madeForKids"`
	TimeZone    string `json:"timeZone"`
}

func (e LiveEventSettings) Preferences() LivePreferences {
	return LivePreferences{e.AccountID, e.Category, e.Language, e.Visibility, e.MadeForKids, e.TimeZone}
}

func (p LivePreferences) Validate() error {
	if p.AccountID < 0 || (p.Category != "" && !liveCategory.MatchString(p.Category)) || (p.Language != "" && !liveLanguage.MatchString(p.Language)) {
		return fmt.Errorf("choose a valid channel, category, and language")
	}
	if p.Visibility != "" && p.Visibility != "private" && p.Visibility != "unlisted" && p.Visibility != "public" {
		return fmt.Errorf("choose valid visibility")
	}
	if p.TimeZone != "" {
		if _, err := time.LoadLocation(p.TimeZone); err != nil {
			return fmt.Errorf("choose a valid time zone")
		}
	}
	return nil
}

type LiveHistoryItem struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	StartedAt string `json:"startedAt"`
}
type LiveHistoryPage struct {
	Items         []LiveHistoryItem `json:"items"`
	NextPageToken string            `json:"nextPageToken"`
}
type LivePreviousStream struct {
	Idea         string
	Package      *LivePackage
	Preferences  LivePreferences
	ThumbnailURL string
}
type LiveReuseResult struct {
	Draft       *LiveDraft      `json:"draft"`
	Preferences LivePreferences `json:"preferences"`
}
