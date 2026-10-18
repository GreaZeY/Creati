package types

import (
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

type LiveTitle struct {
	Text       string `json:"text"`
	Promise    string `json:"promise"`
	Angle      string `json:"angle"`
	Rationale  string `json:"rationale"`
	Scores     [4]int `json:"scores"`
	Characters int    `json:"characters"`
}
type LiveSource struct {
	Title     string `json:"title"`
	URL       string `json:"url"`
	CheckedAt string `json:"checkedAt"`
}
type LiveResearch struct {
	Status  string       `json:"status"`
	Note    string       `json:"note"`
	Sources []LiveSource `json:"sources"`
	Summary string       `json:"summary"`
}
type LiveThumbnail struct {
	Concept    string `json:"concept"`
	FocalPoint string `json:"focalPoint"`
	Crop       string `json:"crop"`
	Background string `json:"background"`
	Contrast   string `json:"contrast"`
	Overlay    string `json:"overlay"`
	Cue        string `json:"cue"`
}
type LivePackage struct {
	SchemaVersion int           `json:"schemaVersion"`
	Title         LiveTitle     `json:"title"`
	Alternatives  []LiveTitle   `json:"alternatives"`
	Assumptions   []string      `json:"assumptions"`
	Description   string        `json:"description"`
	First200      string        `json:"first200"`
	Rundown       []string      `json:"rundown"`
	Tags          []string      `json:"tags"`
	Thumbnail     LiveThumbnail `json:"thumbnail"`
	Category      string        `json:"category"`
	Language      string        `json:"language"`
	Research      LiveResearch  `json:"research"`
}
type LiveDraft struct {
	ID           string             `json:"id"`
	Idea         string             `json:"idea"`
	Context      string             `json:"context"`
	Package      *LivePackage       `json:"package"`
	Questions    []string           `json:"questions"`
	State        string             `json:"state"`
	Step         string             `json:"step"`
	Event        *LiveEventSettings `json:"event"`
	BroadcastID  string             `json:"broadcastId"`
	StreamID     string             `json:"streamId"`
	ThumbnailKey string             `json:"-"`
	HasThumbnail bool               `json:"hasThumbnail"`
	Error        string             `json:"error"`
	UpdatedAt    time.Time          `json:"updatedAt"`
}
type LiveEventSettings struct {
	AccountID      int      `json:"accountId"`
	Title          string   `json:"title"`
	Description    string   `json:"description"`
	Tags           []string `json:"tags"`
	Category       string   `json:"category"`
	Language       string   `json:"language"`
	ScheduledStart string   `json:"scheduledStart"`
	TimeZone       string   `json:"timeZone"`
	Visibility     string   `json:"visibility"`
	MadeForKids    *bool    `json:"madeForKids"`
}

func ValidateLiveText(idea, context string) error {
	if strings.TrimSpace(idea) == "" || utf8.RuneCountInString(idea) > 4000 || utf8.RuneCountInString(context) > 12000 {
		return fmt.Errorf("provide a stream idea up to 4,000 characters and context up to 12,000 characters")
	}
	return nil
}
func ValidateLiveMetadata(title, description string, tags []string) error {
	if strings.TrimSpace(title) == "" || utf8.RuneCountInString(title) > 100 || strings.ContainsAny(title, "<>") {
		return fmt.Errorf("title must contain 1–100 characters without angle brackets")
	}
	if utf8.RuneCountInString(description) > 5000 || strings.ContainsAny(description, "<>") {
		return fmt.Errorf("description must contain at most 5,000 characters without angle brackets")
	}
	if len(tags) > 20 || utf8.RuneCountInString(strings.Join(tags, ",")) > 400 {
		return fmt.Errorf("use at most 20 concise tags, totaling at most 400 characters")
	}
	for _, tag := range tags {
		if strings.TrimSpace(tag) == "" {
			return fmt.Errorf("tags cannot be blank")
		}
	}
	return nil
}
func (p *LivePackage) Normalize() error {
	if p == nil {
		return fmt.Errorf("package is missing")
	}
	p.SchemaVersion = 1
	if err := ValidateLiveMetadata(p.Title.Text, p.Description, p.Tags); err != nil {
		return err
	}
	if len(p.Alternatives) > 2 || len(p.Assumptions) > 10 || len(p.Rundown) > 30 {
		return fmt.Errorf("package contains too many alternatives, assumptions, or segments")
	}
	for _, t := range append([]LiveTitle{p.Title}, p.Alternatives...) {
		if err := ValidateLiveMetadata(t.Text, "", nil); err != nil {
			return err
		}
		for _, score := range t.Scores {
			if score < 1 || score > 5 {
				return fmt.Errorf("title review scores must be between 1 and 5")
			}
		}
	}
	p.Title.Characters = utf8.RuneCountInString(p.Title.Text)
	for i := range p.Alternatives {
		p.Alternatives[i].Characters = utf8.RuneCountInString(p.Alternatives[i].Text)
	}
	runes := []rune(p.Description)
	if len(runes) > 200 {
		runes = runes[:200]
	}
	p.First200 = string(runes)
	if strings.TrimSpace(p.Title.Promise) == "" || strings.TrimSpace(p.Thumbnail.Concept) == "" {
		return fmt.Errorf("package needs a viewer promise and thumbnail concept")
	}
	return nil
}

var liveChapterPattern = regexp.MustCompile(`^(\d{1,2}:\d{2}(?::\d{2})?)\s+`)

func ValidateLiveRundown(segments []string, source string) error {
	var times []int
	for _, segment := range segments {
		match := liveChapterPattern.FindStringSubmatch(segment)
		if match == nil {
			continue
		}
		if !strings.Contains(source, match[1]) {
			return fmt.Errorf("chapter timestamps must come from supplied actual timing")
		}
		seconds := 0
		for _, part := range strings.Split(match[1], ":") {
			value, _ := strconv.Atoi(part)
			if value > 59 {
				return fmt.Errorf("invalid chapter timestamp")
			}
			seconds = seconds*60 + value
		}
		times = append(times, seconds)
	}
	if len(times) == 0 {
		return nil
	}
	if len(times) < 3 || len(times) != len(segments) || times[0] != 0 {
		return fmt.Errorf("chapters need at least three timed segments starting at 00:00")
	}
	for i := 1; i < len(times); i++ {
		if times[i]-times[i-1] < 10 {
			return fmt.Errorf("chapter times must increase by at least ten seconds")
		}
	}
	return nil
}

var liveLanguage = regexp.MustCompile(`^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$`)
var liveCategory = regexp.MustCompile(`^[0-9]{1,3}$`)

func (e LiveEventSettings) Validate(now time.Time) error {
	if err := ValidateLiveMetadata(e.Title, e.Description, e.Tags); err != nil {
		return err
	}
	if e.AccountID < 1 || e.MadeForKids == nil {
		return fmt.Errorf("select a channel and explicitly choose the audience setting")
	}
	if e.Visibility != "private" && e.Visibility != "unlisted" && e.Visibility != "public" {
		return fmt.Errorf("choose event visibility")
	}
	if !liveCategory.MatchString(e.Category) || !liveLanguage.MatchString(e.Language) {
		return fmt.Errorf("choose a category and a valid language code")
	}
	start, err := time.Parse(time.RFC3339, e.ScheduledStart)
	if err != nil || !start.After(now) {
		return fmt.Errorf("schedule must be in the future with an explicit time zone")
	}
	if _, err := time.LoadLocation(e.TimeZone); err != nil {
		return fmt.Errorf("choose a valid IANA time zone")
	}
	return nil
}
func ValidLiveSource(raw string) bool {
	u, err := url.Parse(raw)
	return err == nil && u.Scheme == "https" && u.Host != "" && u.User == nil
}
