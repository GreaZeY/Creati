package repositories

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"creati.in/creati/backend/internal/types"
	"github.com/lib/pq"
)

func TestLiveRepositoryPostgres(t *testing.T) {
	dsn := os.Getenv("CREATI_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("CREATI_TEST_DATABASE_URL is not set")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal("cannot configure database")
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { db.Close() })
	exec := func(query string) {
		t.Helper()
		if _, err := db.Exec(query); err != nil {
			t.Fatal(err)
		}
	}
	schema := pq.QuoteIdentifier(fmt.Sprintf("creati_live_test_%d", time.Now().UnixNano()))
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
	 INSERT INTO platform_accounts VALUES(1,1,NULL,'youtube','active'),(2,1,11,'youtube','active'),(3,2,NULL,'youtube','active')`)
	migration, err := os.ReadFile(filepath.Join("..", "migrations", "15_youtube_live.sql"))
	if err != nil {
		t.Fatal(err)
	}
	exec(string(migration))
	exec(string(migration))
	preferencesMigration, err := os.ReadFile(filepath.Join("..", "migrations", "16_youtube_live_preferences.sql"))
	if err != nil {
		t.Fatal(err)
	}
	exec(string(preferencesMigration))
	exec(string(preferencesMigration))
	r := NewLiveRepository(db)
	ctx := context.Background()
	clientID := 11
	personal := types.UserContext{UserID: 1}
	client := types.UserContext{UserID: 1, ClientID: &clientID}
	other := types.UserContext{UserID: 2}
	kidsPreference := false
	prefs := types.LivePreferences{AccountID: 1, Category: "20", Language: "hi", Visibility: "unlisted", MadeForKids: &kidsPreference, TimeZone: "Asia/Kolkata"}
	if err = r.SavePreferences(ctx, personal, prefs); err != nil {
		t.Fatal(err)
	}
	prefs.Language = "en"
	if err = r.SavePreferences(ctx, personal, prefs); err != nil {
		t.Fatal(err)
	}
	loaded, err := r.Preferences(ctx, personal)
	if err != nil || loaded.Language != "en" || loaded.MadeForKids == nil || *loaded.MadeForKids {
		t.Fatal("preferences did not persist or upsert")
	}
	for _, scope := range []types.UserContext{client, other} {
		isolated, err := r.Preferences(ctx, scope)
		if err != nil || isolated.AccountID != 0 || isolated.Visibility != "" {
			t.Fatal("preferences leaked across a user or workspace")
		}
	}
	prefs.AccountID = 2
	if err = r.SavePreferences(ctx, client, prefs); err != nil {
		t.Fatal(err)
	}
	prefs.Language = "hi"
	if err = r.SavePreferences(ctx, client, prefs); err != nil {
		t.Fatal(err)
	}
	if scoped, err := r.Preferences(ctx, client); err != nil || scoped.AccountID != 2 || scoped.Language != "hi" {
		t.Fatal("workspace preferences did not upsert")
	}
	if r.Authorize(ctx, client, true) != nil {
		t.Fatal("owner cannot publish")
	}
	viewer := types.UserContext{UserID: 2, ClientID: &clientID}
	if r.Authorize(ctx, viewer, false) != nil || r.Authorize(ctx, viewer, true) == nil {
		t.Fatal("viewer publishing policy broken")
	}
	d, err := r.Create(ctx, personal, "An actual stream", "")
	if err != nil {
		t.Fatal(err)
	}
	for _, scope := range []types.UserContext{other, client} {
		if _, err := r.Get(ctx, scope, d.ID); !errors.Is(err, sql.ErrNoRows) {
			t.Fatalf("draft leaked to %+v: %v", scope, err)
		}
	}
	if r.Account(ctx, personal, 2) == nil || r.Account(ctx, personal, 3) == nil || r.Account(ctx, client, 1) == nil || r.Account(ctx, personal, 1) != nil {
		t.Fatal("channel scope isolation failed")
	}
	d.Idea = "Edited brief"
	saved, err := r.Save(ctx, personal, d)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = r.Save(ctx, personal, d); !errors.Is(err, ErrLiveConflict) {
		t.Fatal("stale edit was accepted")
	}
	d = saved
	if err = r.PutOAuth(ctx, client, "state-hash", "session-hash"); err != nil {
		t.Fatal(err)
	}
	if _, err = r.ConsumeOAuth(ctx, 1, "state-hash", "another-session"); err == nil {
		t.Fatal("OAuth state moved across sessions")
	}
	resolved, err := r.ConsumeOAuth(ctx, 1, "state-hash", "session-hash")
	if err != nil || resolved == nil || *resolved != clientID {
		t.Fatal("OAuth context lost")
	}
	if _, err = r.ConsumeOAuth(ctx, 1, "state-hash", "session-hash"); err == nil {
		t.Fatal("OAuth state replayed")
	}
	kids := false
	event := types.LiveEventSettings{AccountID: 1, Title: "Approved title", MadeForKids: &kids}
	d, err = r.ClaimEvent(ctx, personal, d.ID, event)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = r.ClaimEvent(ctx, personal, d.ID, event); !errors.Is(err, ErrLiveConflict) {
		t.Fatal("parallel event claim accepted")
	}
	d.Step = "broadcast_create"
	d.State = "needs_attention"
	if err = r.Progress(ctx, d); err != nil {
		t.Fatal(err)
	}
	if _, err = r.ClaimEvent(ctx, personal, d.ID, event); !errors.Is(err, ErrLiveReconcile) {
		t.Fatal("uncertain creation replayed")
	}
	exec(`UPDATE youtube_live_drafts SET step='metadata',broadcast_id='existing',stream_id='stream'`)
	d, err = r.ClaimEvent(ctx, personal, d.ID, event)
	if err != nil {
		t.Fatal(err)
	}
	d.State = "created"
	d.Step = "complete"
	if err = r.Progress(ctx, d); err != nil {
		t.Fatal(err)
	}
	if result, err := r.ClaimEvent(ctx, personal, d.ID, event); err != nil || result.BroadcastID != "existing" || result.State != "created" {
		t.Fatal("completed event not idempotent")
	}
	changed := event
	changed.Title = "Changed"
	if _, err = r.ClaimEvent(ctx, personal, d.ID, changed); err == nil {
		t.Fatal("submitted event snapshot changed")
	}
	d, err = r.Get(ctx, personal, d.ID)
	if err != nil {
		t.Fatal(err)
	}
	d.Package = &types.LivePackage{Title: types.LiveTitle{Text: "Later edit"}, Research: types.LiveResearch{Status: "verified", Sources: []types.LiveSource{{URL: "https://example.com/", CheckedAt: "2026-10-18"}}}}
	d, err = r.Save(ctx, personal, d)
	if err != nil {
		t.Fatal(err)
	}
	if err = r.Thumbnail(ctx, personal, d.ID, "owned-source.jpg"); err != nil {
		t.Fatal(err)
	}
	copied, err := r.Reuse(ctx, personal, d.ID)
	if err != nil {
		t.Fatal(err)
	}
	if copied.Draft.ID == d.ID || copied.Draft.Event != nil || copied.Draft.BroadcastID != "" || copied.Draft.StreamID != "" || copied.Draft.State != "draft" || !copied.Draft.HasThumbnail {
		t.Fatal("reuse retained event identity or lost the thumbnail")
	}
	if copied.Draft.Package.Title.Text != event.Title || copied.Draft.Package.Research.Status != "reused" || copied.Draft.Package.Research.Sources[0].CheckedAt != "2026-10-18" {
		t.Fatal("reuse changed the original facts or used unsubmitted metadata")
	}
	for _, scope := range []types.UserContext{other, client} {
		if _, err = r.Reuse(ctx, scope, d.ID); !errors.Is(err, sql.ErrNoRows) {
			t.Fatal("reuse leaked a private source")
		}
	}
	original, err := r.Get(ctx, personal, d.ID)
	if err != nil || original.BroadcastID != "existing" || original.Package.Title.Text != "Later edit" {
		t.Fatal("reuse modified its source")
	}
}
