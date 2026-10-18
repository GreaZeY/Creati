package services

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"creati.in/creati/backend/internal/types"
	"google.golang.org/api/option"
	"google.golang.org/api/youtube/v3"
)

type LiveHistoryProvider interface {
	LiveHistory(context.Context, int, string) (*types.LiveHistoryPage, error)
	LivePrevious(context.Context, int, string) (*types.LivePreviousStream, error)
}

func (y *YouTubeService) historyClient(ctx context.Context, accountID int) (*youtube.Service, error) {
	client, err := y.getClient(ctx, accountID)
	if err != nil {
		return nil, err
	}
	return youtube.NewService(ctx, option.WithHTTPClient(client))
}
func (y *YouTubeService) LiveHistory(ctx context.Context, accountID int, pageToken string) (*types.LiveHistoryPage, error) {
	client, err := y.historyClient(ctx, accountID)
	if err != nil {
		return nil, err
	}
	return listPreviousLive(ctx, client, pageToken)
}
func listPreviousLive(ctx context.Context, client *youtube.Service, pageToken string) (*types.LiveHistoryPage, error) {
	result, err := client.LiveBroadcasts.List([]string{"snippet"}).Mine(true).BroadcastType("all").MaxResults(25).PageToken(pageToken).Context(ctx).Do()
	if err != nil {
		return nil, fmt.Errorf("could not load YouTube streams; check the channel connection and Live access")
	}
	page := &types.LiveHistoryPage{Items: []types.LiveHistoryItem{}, NextPageToken: result.NextPageToken}
	for _, b := range result.Items {
		if b.Snippet != nil {
			page.Items = append(page.Items, types.LiveHistoryItem{ID: b.Id, Title: b.Snippet.Title, StartedAt: b.Snippet.ScheduledStartTime})
		}
	}
	return page, nil
}
func (y *YouTubeService) LivePrevious(ctx context.Context, accountID int, id string) (*types.LivePreviousStream, error) {
	client, err := y.historyClient(ctx, accountID)
	if err != nil {
		return nil, err
	}
	return getPreviousLive(ctx, client, id)
}
func getPreviousLive(ctx context.Context, client *youtube.Service, id string) (*types.LivePreviousStream, error) {
	channels, err := client.Channels.List([]string{"id"}).Mine(true).Context(ctx).Do()
	if err != nil || len(channels.Items) != 1 {
		return nil, fmt.Errorf("could not verify the connected YouTube channel")
	}
	broadcasts, err := client.LiveBroadcasts.List([]string{"snippet"}).Id(id).Context(ctx).Do()
	if err != nil || len(broadcasts.Items) != 1 || broadcasts.Items[0].Snippet == nil || broadcasts.Items[0].Snippet.ChannelId != channels.Items[0].Id {
		return nil, fmt.Errorf("the previous stream does not belong to this connected channel")
	}
	videos, err := client.Videos.List([]string{"snippet", "status"}).Id(id).Context(ctx).Do()
	if err != nil || len(videos.Items) != 1 || videos.Items[0].Snippet == nil || videos.Items[0].Status == nil || videos.Items[0].Snippet.ChannelId != channels.Items[0].Id {
		return nil, fmt.Errorf("could not read the previous stream's details")
	}
	v := videos.Items[0]
	s := v.Snippet
	p := &types.LivePackage{SchemaVersion: 1, Title: types.LiveTitle{Text: s.Title, Promise: "Continue the previous stream", Angle: "Reused stream", Scores: [4]int{3, 3, 3, 3}}, Description: s.Description, Tags: s.Tags, Category: s.CategoryId, Language: s.DefaultLanguage, Alternatives: []types.LiveTitle{}, Assumptions: []string{}, Rundown: []string{}, Thumbnail: types.LiveThumbnail{Concept: "Previous stream thumbnail"}, Research: types.LiveResearch{Status: "reused", Note: "Copied from your YouTube stream. Review time-sensitive details or run research again.", Sources: []types.LiveSource{}}}
	if p.Language == "" {
		p.Language = s.DefaultAudioLanguage
	}
	p.Title.Characters = len([]rune(p.Title.Text))
	preview := []rune(p.Description)
	if len(preview) > 200 {
		preview = preview[:200]
	}
	p.First200 = string(preview)
	prefs := types.LivePreferences{Category: p.Category, Language: p.Language, Visibility: v.Status.PrivacyStatus, MadeForKids: &v.Status.MadeForKids}
	result := &types.LivePreviousStream{Idea: s.Title, Package: p, Preferences: prefs}
	if s.Thumbnails != nil {
		for _, thumb := range []*youtube.Thumbnail{s.Thumbnails.Maxres, s.Thumbnails.Standard, s.Thumbnails.High, s.Thumbnails.Medium} {
			if thumb != nil && thumb.Url != "" {
				result.ThumbnailURL = thumb.Url
				break
			}
		}
	}
	return result, nil
}

func PreviousLiveThumbnail(ctx context.Context, raw string) ([]byte, error) {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.User != nil || u.Port() != "" || (u.Hostname() != "i.ytimg.com" && u.Hostname() != "img.youtube.com") {
		return nil, fmt.Errorf("previous thumbnail URL is unavailable")
	}
	client := &http.Client{Timeout: 15 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("could not fetch the previous thumbnail")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK || !strings.HasPrefix(resp.Header.Get("Content-Type"), "image/") {
		return nil, fmt.Errorf("previous thumbnail is unavailable")
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, (8<<20)+1))
	if err != nil || len(data) > 8<<20 {
		return nil, fmt.Errorf("previous thumbnail is too large")
	}
	return normalizeLiveThumbnail(data)
}
