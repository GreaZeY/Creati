package repositories

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"creati.in/creati/backend/internal/types"
	"github.com/google/uuid"
)

func (r *LiveRepository) Preferences(ctx context.Context, s types.UserContext) (*types.LivePreferences, error) {
	var raw []byte
	err := r.db.QueryRowContext(ctx, `SELECT settings FROM youtube_live_preferences WHERE user_id=$1 AND client_id IS NOT DISTINCT FROM $2`, s.UserID, s.ClientID).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		err = r.db.QueryRowContext(ctx, `SELECT approved_event FROM youtube_live_drafts WHERE user_id=$1 AND client_id IS NOT DISTINCT FROM $2 AND approved_event IS NOT NULL ORDER BY updated_at DESC LIMIT 1`, s.UserID, s.ClientID).Scan(&raw)
	}
	p := new(types.LivePreferences)
	if errors.Is(err, sql.ErrNoRows) {
		return p, nil
	}
	if err != nil {
		return nil, err
	}
	if err = json.Unmarshal(raw, p); err != nil {
		return nil, err
	}
	return p, nil
}

type livePreferenceWriter interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
}

func saveLivePreferences(ctx context.Context, db livePreferenceWriter, s types.UserContext, p types.LivePreferences) error {
	data, err := json.Marshal(p)
	if err != nil {
		return err
	}
	conflict := "(user_id) WHERE client_id IS NULL"
	if s.ClientID != nil {
		conflict = "(user_id,client_id) WHERE client_id IS NOT NULL"
	}
	_, err = db.ExecContext(ctx, `INSERT INTO youtube_live_preferences(user_id,client_id,settings) VALUES($1,$2,$3) ON CONFLICT `+conflict+` DO UPDATE SET settings=EXCLUDED.settings,updated_at=NOW()`, s.UserID, s.ClientID, string(data))
	return err
}
func (r *LiveRepository) SavePreferences(ctx context.Context, s types.UserContext, p types.LivePreferences) error {
	return saveLivePreferences(ctx, r.db, s, p)
}

func (r *LiveRepository) Copy(ctx context.Context, s types.UserContext, source *types.LiveDraft) (*types.LiveDraft, error) {
	data, err := json.Marshal(source.Package)
	if err != nil {
		return nil, err
	}
	var pack *types.LivePackage
	if err = json.Unmarshal(data, &pack); err != nil {
		return nil, err
	}
	if pack != nil {
		if source.Event != nil {
			pack.Title.Text = source.Event.Title
			pack.Description = source.Event.Description
			pack.Tags = source.Event.Tags
			pack.Category = source.Event.Category
			pack.Language = source.Event.Language
		}
		pack.Research.Status = "reused"
		pack.Title.Characters = len([]rune(pack.Title.Text))
		preview := []rune(pack.Description)
		if len(preview) > 200 {
			preview = preview[:200]
		}
		pack.First200 = string(preview)
		pack.Research.Note = "Copied from a previous stream. Review time-sensitive details or run research again; source dates are from the original stream."
		data, err = json.Marshal(pack)
		if err != nil {
			return nil, err
		}
	}
	return scanLive(r.db.QueryRowContext(ctx, `INSERT INTO youtube_live_drafts(id,user_id,client_id,idea,context,package,thumbnail_key) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING `+liveColumns, uuid.NewString(), s.UserID, s.ClientID, source.Idea, source.Context, string(data), source.ThumbnailKey))
}

func (r *LiveRepository) Reuse(ctx context.Context, s types.UserContext, id string) (*types.LiveReuseResult, error) {
	source, err := r.Get(ctx, s, id)
	if err != nil {
		return nil, err
	}
	if source.State == "creating" || source.State == "generating" {
		return nil, ErrLiveConflict
	}
	draft, err := r.Copy(ctx, s, source)
	if err != nil {
		return nil, err
	}
	p := types.LivePreferences{}
	if source.Event != nil {
		p = source.Event.Preferences()
	} else if source.Package != nil {
		p.Category = source.Package.Category
		p.Language = source.Package.Language
	}
	return &types.LiveReuseResult{Draft: draft, Preferences: p}, nil
}
