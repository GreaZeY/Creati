package api

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"creati.in/creati/backend/internal/middleware"
	"creati.in/creati/backend/internal/services"
	"creati.in/creati/backend/internal/types"
	"github.com/gofiber/fiber/v2"
	"github.com/lib/pq"
)

type liveAPIGateway struct{ creates int }

func (g *liveAPIGateway) CreateBroadcast(context.Context, types.LiveEventSettings) (string, error) {
	g.creates++
	return "verified-broadcast", nil
}
func (*liveAPIGateway) CreateStream(context.Context, string) (string, error) {
	return "verified-stream", nil
}
func (*liveAPIGateway) Bind(context.Context, string, string) error                      { return nil }
func (*liveAPIGateway) Metadata(context.Context, string, types.LiveEventSettings) error { return nil }
func (*liveAPIGateway) Thumbnail(_ context.Context, _ string, r io.Reader) error {
	_, _, err := image.DecodeConfig(r)
	return err
}

func TestLiveHTTPPostgres(t *testing.T) {
	dsn := os.Getenv("CREATI_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("CREATI_TEST_DATABASE_URL is not set")
	}
	migration, err := os.ReadFile(filepath.Join("..", "db", "migrations", "15_youtube_live.sql"))
	if err != nil {
		t.Fatal(err)
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal("cannot configure test database")
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { db.Close() })
	exec := func(query string) {
		t.Helper()
		if _, err := db.Exec(query); err != nil {
			t.Fatal(err)
		}
	}
	schema := pq.QuoteIdentifier(fmt.Sprintf("creati_live_http_%d", time.Now().UnixNano()))
	exec("CREATE SCHEMA " + schema)
	t.Cleanup(func() {
		if _, err := db.Exec("DROP SCHEMA " + schema + " CASCADE"); err != nil {
			t.Error(err)
		}
	})
	exec("SET search_path TO " + schema + ", public")
	exec(`CREATE TABLE users(id INTEGER PRIMARY KEY); INSERT INTO users VALUES(1),(2);
	 CREATE TABLE organizations(id INTEGER PRIMARY KEY,owner_id INTEGER); INSERT INTO organizations VALUES(1,1);
	 CREATE TABLE clients(id INTEGER PRIMARY KEY,org_id INTEGER); INSERT INTO clients VALUES(11,1);
	 CREATE TABLE team_members(org_id INTEGER,user_id INTEGER,role TEXT,status TEXT); INSERT INTO team_members VALUES(1,2,'viewer','active');
	 CREATE TABLE platform_accounts(id INTEGER PRIMARY KEY,user_id INTEGER,client_id INTEGER,platform TEXT,status TEXT);
	 INSERT INTO platform_accounts VALUES(1,1,NULL,'youtube','active');`)
	exec(string(migration))
	preferencesMigration, err := os.ReadFile(filepath.Join("..", "db", "migrations", "16_youtube_live_preferences.sql"))
	if err != nil {
		t.Fatal(err)
	}
	exec(string(preferencesMigration))
	t.Chdir(t.TempDir())
	t.Setenv("STORAGE_DRIVER", "local")
	storage, err := services.NewStorageService(db)
	if err != nil {
		t.Fatal(err)
	}
	var encoded bytes.Buffer
	if err = jpeg.Encode(&encoded, image.NewRGBA(image.Rect(0, 0, 640, 360)), nil); err != nil {
		t.Fatal(err)
	}
	model := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/images/generations") {
			_ = json.NewEncoder(w).Encode(map[string]any{"data": []any{map[string]string{"b64_json": base64.StdEncoding.EncodeToString(encoded.Bytes())}}})
			return
		}
		var body map[string]json.RawMessage
		_ = json.NewDecoder(r.Body).Decode(&body)
		if len(body["tools"]) > 0 {
			fmt.Fprint(w, `{"stop_reason":"end_turn","content":[{"type":"server_tool_use","name":"web_search"},{"type":"text","text":"A concrete researched packaging observation.","citations":[{"url":"https://support.google.com/youtube/answer/12340300","title":"YouTube title guidance"}]}]}`)
			return
		}
		pack := types.LivePackage{Title: types.LiveTitle{Text: "Valorant: Can Chat Get Me to Gold?", Promise: "Chat chooses an agent for a ranked attempt", Scores: [4]int{4, 5, 5, 4}}, Description: "A real ranked challenge with chat.", Category: "20", Language: "en", Thumbnail: types.LiveThumbnail{Concept: "An illustrative agent selection scene"}}
		data, _ := json.Marshal(map[string]any{"package": pack})
		_ = json.NewEncoder(w).Encode(map[string]any{"stop_reason": "end_turn", "content": []any{map[string]string{"type": "text", "text": string(data)}}})
	}))
	defer model.Close()
	h := NewLiveHandler(db, storage, nil)
	h.producer = services.NewLiveProducer(services.LiveProducerConfig{BaseURL: model.URL, APIKey: "test", Model: "text", SearchTool: "search"}, model.Client())
	h.images = services.NewLiveImageGenerator(services.LiveImageConfig{BaseURL: model.URL, APIKey: "test", Model: "image"}, model.Client())
	gateway := &liveAPIGateway{}
	h.events.Gateway = func(context.Context, int) (services.LiveGateway, error) { return gateway, nil }
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error { c.Locals("userID", 1); return c.Next() })
	app.Use(middleware.TenancyMiddleware(db))
	h.Register(app.Group("/api/youtube-live"))
	ownerRequest := httptest.NewRequest("POST", "/api/youtube-live/drafts", strings.NewReader(`{"idea":"Owner client stream"}`))
	ownerRequest.Host = "localhost"
	ownerRequest.Header.Set("Content-Type", "application/json")
	ownerRequest.Header.Set("X-Workspace-ID", "11")
	ownerResponse, err := app.Test(ownerRequest)
	if err != nil {
		t.Fatal(err)
	}
	ownerResponse.Body.Close()
	if ownerResponse.StatusCode != 201 {
		t.Fatalf("workspace owner without a team row was denied: %d", ownerResponse.StatusCode)
	}
	request := func(method, path string, body any, status int) types.LiveDraft {
		t.Helper()
		data, _ := json.Marshal(body)
		req := httptest.NewRequest(method, "/api/youtube-live"+path, bytes.NewReader(data))
		req.Host = "localhost"
		req.Header.Set("Content-Type", "application/json")
		resp, err := app.Test(req, 20000)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		var envelope struct {
			Data  types.LiveDraft `json:"data"`
			Error string          `json:"error"`
		}
		if err = json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
			t.Fatal(err)
		}
		if resp.StatusCode != status {
			t.Fatalf("%s %s: status %d, error %s", method, path, resp.StatusCode, envelope.Error)
		}
		return envelope.Data
	}
	d := request("POST", "/drafts", map[string]string{"idea": "Valorant with chat picking the agent"}, 201)
	d = request("POST", "/drafts/"+d.ID+"/generate", map[string]bool{"research": true}, 200)
	if d.Package == nil || d.Package.Research.Status != "verified" || d.Package.Research.Summary == "" {
		t.Fatal("package has no actual research")
	}
	d = request("POST", "/drafts/"+d.ID+"/generate-thumbnail", nil, 200)
	if !d.HasThumbnail {
		t.Fatal("image generation did not attach a thumbnail")
	}
	resp, err := app.Test(httptest.NewRequest("GET", "/api/youtube-live/drafts/"+d.ID+"/thumbnail", nil))
	if err != nil {
		t.Fatal(err)
	}
	config, _, err := image.DecodeConfig(resp.Body)
	resp.Body.Close()
	if err != nil || config.Width != 1280 || config.Height != 720 {
		t.Fatal("thumbnail preview invalid")
	}
	kids := false
	event := types.LiveEventSettings{AccountID: 1, Title: d.Package.Title.Text, Description: d.Package.Description, Category: "20", Language: "en", Visibility: "private", MadeForKids: &kids, TimeZone: "Asia/Kolkata", ScheduledStart: time.Now().Add(time.Hour).UTC().Format(time.RFC3339)}
	for i := 0; i < 2; i++ {
		d = request("POST", "/drafts/"+d.ID+"/create-event", event, 200)
		if d.State != "created" || d.BroadcastID == "" {
			t.Fatal("approved event not created")
		}
	}
	if gateway.creates != 1 {
		t.Fatal("double approval created a duplicate event")
	}
	d.Idea = "Edited notes after setup"
	d = request("PATCH", "/drafts/"+d.ID, d, 200)
	if d.Idea != "Edited notes after setup" {
		t.Fatal("event response returned a stale edit version")
	}
	jsonRequest := func(method, path string, body any, status int, workspace string) json.RawMessage {
		t.Helper()
		data, _ := json.Marshal(body)
		req := httptest.NewRequest(method, "/api/youtube-live"+path, bytes.NewReader(data))
		req.Host = "localhost"
		req.Header.Set("Content-Type", "application/json")
		if workspace != "" {
			req.Header.Set("X-Workspace-ID", workspace)
		}
		response, err := app.Test(req, 20000)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		var envelope struct {
			Data  json.RawMessage `json:"data"`
			Error string          `json:"error"`
		}
		if err = json.NewDecoder(response.Body).Decode(&envelope); err != nil {
			t.Fatal(err)
		}
		if response.StatusCode != status {
			t.Fatalf("%s %s: %d %s", method, path, response.StatusCode, envelope.Error)
		}
		return envelope.Data
	}
	var preferences types.LivePreferences
	if err = json.Unmarshal(jsonRequest("GET", "/preferences", nil, 200, ""), &preferences); err != nil || preferences.AccountID != 1 || preferences.Visibility != "private" || preferences.MadeForKids == nil || *preferences.MadeForKids {
		t.Fatal("approved preferences were not saved to the database")
	}
	preferences.Visibility = "unlisted"
	jsonRequest("PUT", "/preferences", preferences, 200, "")
	if err = json.Unmarshal(jsonRequest("GET", "/preferences", nil, 200, ""), &preferences); err != nil || preferences.Visibility != "unlisted" {
		t.Fatal("edited preferences did not persist")
	}
	preferences.AccountID = 999
	jsonRequest("PUT", "/preferences", preferences, 404, "")
	jsonRequest("PUT", "/preferences", map[string]any{"visibility": "invalid"}, 400, "")
	jsonRequest("PUT", "/preferences", map[string]any{"timeZone": "Invalid/Zone"}, 400, "")
	jsonRequest("GET", "/channels/999/history", nil, 404, "")
	var reused types.LiveReuseResult
	if err = json.Unmarshal(jsonRequest("POST", "/drafts/"+d.ID+"/reuse", nil, 201, ""), &reused); err != nil || reused.Draft.ID == d.ID || reused.Draft.Event != nil || reused.Draft.BroadcastID != "" || !reused.Draft.HasThumbnail {
		t.Fatal("HTTP reuse did not produce an independent draft")
	}
	jsonRequest("POST", "/drafts/"+d.ID+"/reuse", nil, 404, "11")
	h.history = liveAPIHistory{}
	jsonRequest("GET", "/channels/1/history?pageToken=next", nil, 200, "")
	if err = json.Unmarshal(jsonRequest("POST", "/channels/1/history/external-stream/reuse", nil, 201, ""), &reused); err != nil || reused.Draft.Package.Title.Text != "Imported game stream" || reused.Preferences.AccountID != 1 || reused.Draft.Event != nil || reused.Draft.BroadcastID != "" {
		t.Fatal("YouTube reuse lost metadata or retained source IDs")
	}
}

type liveAPIHistory struct{}

func (liveAPIHistory) LiveHistory(context.Context, int, string) (*types.LiveHistoryPage, error) {
	return &types.LiveHistoryPage{Items: []types.LiveHistoryItem{{ID: "external-stream", Title: "Imported game stream"}}}, nil
}
func (liveAPIHistory) LivePrevious(context.Context, int, string) (*types.LivePreviousStream, error) {
	return &types.LivePreviousStream{Idea: "Imported game stream", Package: &types.LivePackage{Title: types.LiveTitle{Text: "Imported game stream"}, Research: types.LiveResearch{Status: "reused"}}, Preferences: types.LivePreferences{Visibility: "unlisted", Category: "20", Language: "hi"}}, nil
}
