package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"creati.in/creati/backend/internal/db/repositories"
	"creati.in/creati/backend/internal/types"
	"google.golang.org/api/option"
	"google.golang.org/api/youtube/v3"
)

func liveFixturePackage() types.LivePackage {
	return types.LivePackage{Title: types.LiveTitle{Text: "Valorant: chat picks the agent", Promise: "Chat chooses the challenge", Scores: [4]int{3, 4, 4, 5}}, Description: "Play ranked matches with chat.", Thumbnail: types.LiveThumbnail{Concept: "Real agent screenshot"}}
}
func TestLiveProducerResearchAndAuthentication(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.URL.Path != "/v1/messages" || r.Header.Get("Authorization") != "Bearer route-token" || r.Header.Get("x-api-key") != "" {
			t.Error("wrong route or authentication precedence")
		}
		var body map[string]json.RawMessage
		if json.NewDecoder(r.Body).Decode(&body) != nil {
			t.Fatal("bad request")
		}
		if calls == 1 {
			if len(body["tools"]) == 0 {
				t.Error("research tool missing")
			}
			fmt.Fprint(w, `{"stop_reason":"end_turn","content":[{"type":"server_tool_use","name":"web_search"},{"type":"text","text":"Official title guidance.","citations":[{"url":"https://support.google.com/youtube/answer/12340300","title":"YouTube"}]}]}`)
			return
		}
		if len(body["tools"]) != 0 {
			t.Error("generation should not run search tools")
		}
		data, _ := json.Marshal(map[string]any{"questions": []string{}, "package": liveFixturePackage()})
		_ = json.NewEncoder(w).Encode(map[string]any{"stop_reason": "end_turn", "content": []any{map[string]string{"type": "text", "text": string(data)}}})
	}))
	defer server.Close()
	p := NewLiveProducer(LiveProducerConfig{BaseURL: server.URL, Model: "route-combo", Token: "route-token", APIKey: "ignored", SearchTool: "web_search_20250305"}, server.Client())
	pack, _, err := p.Generate(context.Background(), "Play Valorant", "Chat picks the agent", true)
	if err != nil {
		t.Fatal(err)
	}
	if calls != 2 || pack.Research.Status != "verified" || len(pack.Research.Sources) != 1 || pack.Title.Characters == 0 {
		t.Fatalf("bad package: %+v", pack)
	}
}
func TestLiveProducerSearchFailureAndMalformedOutput(t *testing.T) {
	for _, malformed := range []bool{false, true} {
		t.Run(fmt.Sprint(malformed), func(t *testing.T) {
			calls := 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls++
				if calls == 1 {
					fmt.Fprint(w, `{"stop_reason":"end_turn","content":[{"type":"server_tool_use","name":"web_search"},{"type":"web_search_tool_result","content":{"type":"web_search_tool_result_error","error_code":"unavailable"}}]}`)
					return
				}
				data, _ := json.Marshal(map[string]any{"package": liveFixturePackage()})
				text := string(data)
				if malformed {
					text = "not json"
				}
				_ = json.NewEncoder(w).Encode(map[string]any{"stop_reason": "end_turn", "content": []any{map[string]string{"type": "text", "text": text}}})
			}))
			defer server.Close()
			p := NewLiveProducer(LiveProducerConfig{BaseURL: server.URL, Model: "test", APIKey: "test", SearchTool: "search"}, server.Client())
			pack, _, err := p.Generate(context.Background(), "A stream", "", true)
			if err == nil || pack != nil {
				t.Fatalf("research failure must not silently generate a generic package: %+v %v", pack, err)
			}
		})
	}
}

type liveMemoryStore struct {
	draft  types.LiveDraft
	denied bool
}

func (s *liveMemoryStore) Account(context.Context, types.UserContext, int) error {
	if s.denied {
		return errors.New("denied")
	}
	return nil
}
func (s *liveMemoryStore) ClaimEvent(_ context.Context, _ types.UserContext, _ string, e types.LiveEventSettings) (*types.LiveDraft, error) {
	if (s.draft.Step == "broadcast_create" && s.draft.BroadcastID == "") || (s.draft.Step == "stream_create" && s.draft.StreamID == "") {
		return nil, repositories.ErrLiveReconcile
	}
	d := s.draft
	d.Event = &e
	if d.State != "created" {
		d.State = "creating"
	}
	s.draft = d
	return &d, nil
}
func (s *liveMemoryStore) Progress(_ context.Context, d *types.LiveDraft) error {
	s.draft = *d
	return nil
}

type liveFakeGateway struct {
	creates, streams         int
	metadataFails, uncertain bool
}

func (g *liveFakeGateway) CreateBroadcast(context.Context, types.LiveEventSettings) (string, error) {
	g.creates++
	if g.uncertain {
		return "", errors.New("timeout")
	}
	return "broadcast", nil
}
func (g *liveFakeGateway) CreateStream(context.Context, string) (string, error) {
	g.streams++
	return "stream", nil
}
func (*liveFakeGateway) Bind(context.Context, string, string) error { return nil }
func (g *liveFakeGateway) Metadata(context.Context, string, types.LiveEventSettings) error {
	if g.metadataFails {
		return errors.New("temporarily unavailable")
	}
	return nil
}
func (*liveFakeGateway) Thumbnail(context.Context, string, io.Reader) error { return nil }
func TestLiveCreationRetryDoesNotDuplicateEvents(t *testing.T) {
	store := &liveMemoryStore{draft: types.LiveDraft{ID: "draft"}}
	gateway := &liveFakeGateway{metadataFails: true}
	s := LiveEventService{Store: store, Gateway: func(context.Context, int) (LiveGateway, error) { return gateway, nil }}
	d, err := s.Create(context.Background(), types.UserContext{UserID: 1}, "draft", types.LiveEventSettings{AccountID: 1})
	if err != nil || d.State != "needs_attention" {
		t.Fatalf("expected resumable result: %+v %v", d, err)
	}
	gateway.metadataFails = false
	for i := 0; i < 2; i++ {
		d, err = s.Create(context.Background(), types.UserContext{UserID: 1}, "draft", types.LiveEventSettings{AccountID: 1})
		if err != nil || d.State != "created" {
			t.Fatalf("resume: %+v %v", d, err)
		}
	}
	if gateway.creates != 1 || gateway.streams != 1 {
		t.Fatal("retry duplicated YouTube resources")
	}
}
func TestLiveCreationBlocksAmbiguousRetryAndUnauthorizedChannel(t *testing.T) {
	store := &liveMemoryStore{draft: types.LiveDraft{ID: "draft"}, denied: true}
	gateway := &liveFakeGateway{uncertain: true}
	s := LiveEventService{Store: store, Gateway: func(context.Context, int) (LiveGateway, error) { return gateway, nil }}
	if _, err := s.Create(context.Background(), types.UserContext{}, "draft", types.LiveEventSettings{}); err == nil || gateway.creates != 0 {
		t.Fatal("unauthorized provider call")
	}
	store.denied = false
	if _, err := s.Create(context.Background(), types.UserContext{}, "draft", types.LiveEventSettings{}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Create(context.Background(), types.UserContext{}, "draft", types.LiveEventSettings{}); !errors.Is(err, repositories.ErrLiveReconcile) {
		t.Fatalf("ambiguous creation replayed: %v", err)
	}
	if gateway.creates != 1 {
		t.Fatal("ambiguous request duplicated a broadcast")
	}
}
func TestGoogleLiveRequestDisablesAutomaticStart(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			ContentDetails map[string]any `json:"contentDetails"`
			Status         map[string]any `json:"status"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if value, exists := body.ContentDetails["enableAutoStart"]; !exists || value != false {
			t.Error("auto-start false was omitted")
		}
		if value, exists := body.Status["selfDeclaredMadeForKids"]; !exists || value != false {
			t.Error("explicit audience choice omitted")
		}
		fmt.Fprint(w, `{"id":"test-broadcast"}`)
	}))
	defer server.Close()
	client, err := youtube.NewService(context.Background(), option.WithEndpoint(server.URL+"/"), option.WithHTTPClient(server.Client()))
	if err != nil {
		t.Fatal(err)
	}
	kids := false
	g := googleLiveGateway{client: client}
	id, err := g.CreateBroadcast(context.Background(), types.LiveEventSettings{Title: "Test", MadeForKids: &kids})
	if err != nil || !strings.Contains(id, "test") {
		t.Fatalf("create: %q %v", id, err)
	}
}
