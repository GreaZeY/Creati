package types

import (
	"strings"
	"testing"
	"time"
)

func TestLiveUnicodeAndLimits(t *testing.T) {
	p := &LivePackage{Title: LiveTitle{Text: strings.Repeat("🎮", 100), Promise: "Try a real challenge", Scores: [4]int{3, 4, 5, 4}}, Description: strings.Repeat("界", 220), Thumbnail: LiveThumbnail{Concept: "Real screenshot"}}
	if err := p.Normalize(); err != nil {
		t.Fatal(err)
	}
	if p.Title.Characters != 100 || len([]rune(p.First200)) != 200 {
		t.Fatalf("wrong Unicode counts: %+v", p)
	}
	p.Title.Text += "a"
	if p.Normalize() == nil {
		t.Fatal("accepted oversized title")
	}
	p.Title.Text = "Valid"
	p.Title.Scores[0] = 6
	if p.Normalize() == nil {
		t.Fatal("accepted invalid score")
	}
}
func TestLiveSettingsRequireExplicitChoices(t *testing.T) {
	now := time.Now()
	kids := false
	e := LiveEventSettings{AccountID: 1, Title: "A real stream", Category: "20", Language: "en-US", Visibility: "private", ScheduledStart: now.Add(time.Hour).Format(time.RFC3339), TimeZone: "Asia/Kolkata"}
	if e.Validate(now) == nil {
		t.Fatal("inferred audience choice")
	}
	e.MadeForKids = &kids
	if err := e.Validate(now); err != nil {
		t.Fatal(err)
	}
	e.Visibility = ""
	if e.Validate(now) == nil {
		t.Fatal("inferred privacy")
	}
	if ValidLiveSource("javascript:alert(1)") || ValidLiveSource("https://user:secret@example.com") || !ValidLiveSource("https://support.google.com/youtube/") {
		t.Fatal("source validation failed")
	}
}

func TestLiveRundownRejectsInventedTimes(t *testing.T) {
	if err := ValidateLiveRundown([]string{"Warm-up", "Ranked games"}, ""); err != nil {
		t.Fatal(err)
	}
	times := []string{"00:00 Start", "00:30 Challenge", "01:00 Recap"}
	if ValidateLiveRundown(times, "") == nil {
		t.Fatal("accepted invented times")
	}
	if err := ValidateLiveRundown(times, "Actual times 00:00, 00:30, 01:00"); err != nil {
		t.Fatal(err)
	}
	if ValidateLiveRundown([]string{"00:00 Start", "00:05 Next", "01:00 End"}, "00:00 00:05 01:00") == nil {
		t.Fatal("accepted short chapter")
	}
}

func TestLivePreferencesAllowPartialChoices(t *testing.T) {
	kids := false
	valid := LivePreferences{Category: "20", Language: "hi-IN", Visibility: "private", MadeForKids: &kids, TimeZone: "Asia/Kolkata"}
	if err := valid.Validate(); err != nil {
		t.Fatal(err)
	}
	if err := (LivePreferences{}).Validate(); err != nil {
		t.Fatal("partial preferences rejected")
	}
	for _, p := range []LivePreferences{{AccountID: -1}, {Category: "game"}, {Language: "x"}, {Visibility: "world"}, {TimeZone: "Invalid/Zone"}} {
		if p.Validate() == nil {
			t.Fatalf("accepted invalid preferences: %+v", p)
		}
	}
}
