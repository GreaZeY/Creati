package services

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"google.golang.org/api/option"
	"google.golang.org/api/youtube/v3"
)

func TestPreviousLiveHistoryOwnershipAndMetadata(t *testing.T) {
	foreign := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case strings.HasSuffix(r.URL.Path, "channels"):
			if r.URL.Query().Get("mine") != "true" {
				t.Error("channel identity was not requested")
			}
			_, _ = w.Write([]byte(`{"items":[{"id":"owned-channel"}]}`))
		case strings.HasSuffix(r.URL.Path, "liveBroadcasts"):
			if r.URL.Query().Get("id") == "" {
				if r.URL.Query().Get("mine") != "true" || r.URL.Query().Get("broadcastStatus") != "" || r.URL.Query().Get("pageToken") != "next" {
					t.Error("history request used an invalid filter or lost pagination")
				}
				_, _ = w.Write([]byte(`{"nextPageToken":"later","items":[{"id":"previous","snippet":{"title":"Game part 1","scheduledStartTime":"2026-10-18T16:00:00Z"}}]}`))
			} else {
				channel := "owned-channel"
				if foreign {
					channel = "someone-else"
				}
				_ = json.NewEncoder(w).Encode(map[string]any{"items": []any{map[string]any{"id": "previous", "snippet": map[string]string{"channelId": channel}}}})
			}
		case strings.HasSuffix(r.URL.Path, "videos"):
			_, _ = w.Write([]byte(`{"items":[{"id":"previous","snippet":{"channelId":"owned-channel","title":"Game part 1","description":"Continue this story","tags":["game","Hindi gameplay"],"categoryId":"20","defaultAudioLanguage":"hi","thumbnails":{"high":{"url":"https://i.ytimg.com/vi/previous/hqdefault.jpg"}}},"status":{"privacyStatus":"unlisted","madeForKids":false}}]}`))
		default:
			t.Errorf("unexpected YouTube request: %s", r.URL.Path)
		}
	}))
	defer server.Close()
	ctx := context.Background()
	client, err := youtube.NewService(ctx, option.WithEndpoint(server.URL+"/"), option.WithHTTPClient(server.Client()))
	if err != nil {
		t.Fatal(err)
	}
	page, err := listPreviousLive(ctx, client, "next")
	if err != nil || len(page.Items) != 1 || page.NextPageToken != "later" {
		t.Fatal("history or pagination lost")
	}
	previous, err := getPreviousLive(ctx, client, "previous")
	if err != nil {
		t.Fatal(err)
	}
	if previous.Package.Title.Text != "Game part 1" || previous.Package.Language != "hi" || len(previous.Package.Tags) != 2 || previous.Package.Research.Status != "reused" || previous.Preferences.Visibility != "unlisted" || previous.Preferences.MadeForKids == nil || *previous.Preferences.MadeForKids || previous.ThumbnailURL == "" {
		t.Fatal("previous stream fields were not copied")
	}
	foreign = true
	if _, err = getPreviousLive(ctx, client, "previous"); err == nil {
		t.Fatal("imported someone else's broadcast")
	}
}

func TestPreviousLiveThumbnailRejectsUntrustedURLs(t *testing.T) {
	for _, raw := range []string{"http://i.ytimg.com/test.jpg", "https://localhost/test.jpg", "https://i.ytimg.com.evil.example/test.jpg", "https://user:pass@i.ytimg.com/test.jpg", "https://i.ytimg.com:8000/test.jpg", "file:///etc/passwd"} {
		if _, err := PreviousLiveThumbnail(context.Background(), raw); err == nil {
			t.Fatalf("accepted untrusted thumbnail: %s", raw)
		}
	}
}
