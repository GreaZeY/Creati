package repositories

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"time"

	"creati.in/creati/backend/internal/types"
	"github.com/google/uuid"
)

var ErrLiveConflict = errors.New("draft changed or an operation is in progress; reload before retrying")
var ErrLiveReconcile = errors.New("a creation request has an uncertain result; check YouTube Studio before retrying")

type LiveRepository struct{ db *sql.DB }

func NewLiveRepository(db *sql.DB) *LiveRepository { return &LiveRepository{db: db} }

func (r *LiveRepository) Authorize(ctx context.Context, scope types.UserContext, write bool) error {
	if scope.UserID < 1 {
		return sql.ErrNoRows
	}
	if scope.ClientID == nil {
		return nil
	}
	var ok bool
	err := r.db.QueryRowContext(ctx, `SELECT EXISTS (
	 SELECT 1 FROM clients c JOIN organizations o ON o.id=c.org_id
	 LEFT JOIN team_members tm ON tm.org_id=o.id AND tm.user_id=$1 AND tm.status='active'
	 WHERE c.id=$2 AND (o.owner_id=$1 OR (tm.user_id IS NOT NULL AND (NOT $3 OR tm.role IN ('owner','admin','editor'))))
	)`, scope.UserID, *scope.ClientID, write).Scan(&ok)
	if err != nil {
		return err
	}
	if !ok {
		return sql.ErrNoRows
	}
	return nil
}

const liveColumns = `id,idea,context,package,questions,state,step,approved_event,broadcast_id,stream_id,thumbnail_key,error_summary,updated_at`

type liveScanner interface{ Scan(...any) error }

func scanLive(row liveScanner) (*types.LiveDraft, error) {
	d := new(types.LiveDraft)
	var pack, event, questions []byte
	err := row.Scan(&d.ID, &d.Idea, &d.Context, &pack, &questions, &d.State, &d.Step, &event, &d.BroadcastID, &d.StreamID, &d.ThumbnailKey, &d.Error, &d.UpdatedAt)
	if err != nil {
		return nil, err
	}
	if len(pack) > 0 {
		if err = json.Unmarshal(pack, &d.Package); err != nil {
			return nil, err
		}
	}
	if len(event) > 0 {
		if err = json.Unmarshal(event, &d.Event); err != nil {
			return nil, err
		}
	}
	if err = json.Unmarshal(questions, &d.Questions); err != nil {
		return nil, err
	}
	d.HasThumbnail = d.ThumbnailKey != ""
	return d, nil
}
func (r *LiveRepository) Create(ctx context.Context, s types.UserContext, idea, contextText string) (*types.LiveDraft, error) {
	return scanLive(r.db.QueryRowContext(ctx, `INSERT INTO youtube_live_drafts(id,user_id,client_id,idea,context) VALUES($1,$2,$3,$4,$5) RETURNING `+liveColumns, uuid.NewString(), s.UserID, s.ClientID, idea, contextText))
}
func (r *LiveRepository) Get(ctx context.Context, s types.UserContext, id string) (*types.LiveDraft, error) {
	_, err := r.db.ExecContext(ctx, `UPDATE youtube_live_drafts SET state=CASE WHEN state='creating' THEN 'needs_attention' WHEN broadcast_id<>'' THEN 'created' ELSE 'draft' END,error_summary=CASE WHEN state='creating' THEN 'Operation interrupted; check YouTube Studio before retrying.' ELSE error_summary END WHERE id=$1 AND user_id=$2 AND client_id IS NOT DISTINCT FROM $3 AND state IN ('creating','generating') AND updated_at<NOW()-INTERVAL '4 minutes'`, id, s.UserID, s.ClientID)
	if err != nil {
		return nil, err
	}
	return scanLive(r.db.QueryRowContext(ctx, `SELECT `+liveColumns+` FROM youtube_live_drafts WHERE id=$1 AND user_id=$2 AND client_id IS NOT DISTINCT FROM $3`, id, s.UserID, s.ClientID))
}
func (r *LiveRepository) List(ctx context.Context, s types.UserContext) ([]*types.LiveDraft, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+liveColumns+` FROM youtube_live_drafts WHERE user_id=$1 AND client_id IS NOT DISTINCT FROM $2 ORDER BY updated_at DESC LIMIT 30`, s.UserID, s.ClientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*types.LiveDraft{}
	for rows.Next() {
		d, err := scanLive(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}
func (r *LiveRepository) Save(ctx context.Context, s types.UserContext, d *types.LiveDraft) (*types.LiveDraft, error) {
	pack, err := json.Marshal(d.Package)
	if err != nil {
		return nil, err
	}
	row := r.db.QueryRowContext(ctx, `UPDATE youtube_live_drafts SET idea=$4,context=$5,package=$6,updated_at=NOW()
	 WHERE id=$1 AND user_id=$2 AND client_id IS NOT DISTINCT FROM $3 AND state NOT IN ('creating','generating') AND updated_at=$7 RETURNING `+liveColumns, d.ID, s.UserID, s.ClientID, d.Idea, d.Context, string(pack), d.UpdatedAt)
	updated, err := scanLive(row)
	if err == sql.ErrNoRows {
		return nil, ErrLiveConflict
	}
	return updated, err
}
func (r *LiveRepository) BeginGeneration(ctx context.Context, s types.UserContext, id string) (*types.LiveDraft, error) {
	d, err := scanLive(r.db.QueryRowContext(ctx, `UPDATE youtube_live_drafts SET state='generating',updated_at=NOW() WHERE id=$1 AND user_id=$2 AND client_id IS NOT DISTINCT FROM $3 AND state NOT IN ('generating','creating') RETURNING `+liveColumns, id, s.UserID, s.ClientID))
	if err == sql.ErrNoRows {
		return nil, ErrLiveConflict
	}
	return d, err
}
func (r *LiveRepository) EndGeneration(ctx context.Context, s types.UserContext, id string, p *types.LivePackage, questions []string) error {
	pack, err := json.Marshal(p)
	if err != nil {
		return err
	}
	q, err := json.Marshal(questions)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx, `UPDATE youtube_live_drafts SET package=COALESCE(NULLIF($4::jsonb,'null'::jsonb),package),questions=$5,state=CASE WHEN step='complete' THEN 'created' WHEN approved_event IS NOT NULL THEN 'needs_attention' ELSE 'draft' END,updated_at=NOW() WHERE id=$1 AND user_id=$2 AND client_id IS NOT DISTINCT FROM $3 AND state='generating'`, id, s.UserID, s.ClientID, string(pack), string(q))
	return err
}
func (r *LiveRepository) ClaimEvent(ctx context.Context, s types.UserContext, id string, event types.LiveEventSettings) (*types.LiveDraft, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	d, err := scanLive(tx.QueryRowContext(ctx, `SELECT `+liveColumns+` FROM youtube_live_drafts WHERE id=$1 AND user_id=$2 AND client_id IS NOT DISTINCT FROM $3 FOR UPDATE`, id, s.UserID, s.ClientID))
	if err != nil {
		return nil, err
	}
	if d.State == "creating" || d.State == "generating" {
		return nil, ErrLiveConflict
	}
	if d.Event != nil && !reflect.DeepEqual(*d.Event, event) {
		return nil, fmt.Errorf("%w: event settings are locked after submission; create another draft for a different event", ErrLiveConflict)
	}
	if d.State == "created" {
		return d, nil
	}
	if (d.Step == "broadcast_create" && d.BroadcastID == "") || (d.Step == "stream_create" && d.StreamID == "") {
		return nil, ErrLiveReconcile
	}
	data, _ := json.Marshal(event)
	_, err = tx.ExecContext(ctx, `UPDATE youtube_live_drafts SET approved_event=$2,state='creating',error_summary='',updated_at=NOW() WHERE id=$1`, id, string(data))
	if err != nil {
		return nil, err
	}
	if err = saveLivePreferences(ctx, tx, s, event.Preferences()); err != nil {
		return nil, err
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	d.Event = &event
	d.State = "creating"
	d.Error = ""
	return d, nil
}
func (r *LiveRepository) Progress(ctx context.Context, d *types.LiveDraft) error {
	result, err := r.db.ExecContext(ctx, `UPDATE youtube_live_drafts SET state=$2,step=$3,broadcast_id=$4,stream_id=$5,error_summary=$6,updated_at=NOW() WHERE id=$1 AND state='creating'`, d.ID, d.State, d.Step, d.BroadcastID, d.StreamID, d.Error)
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err == nil && n != 1 {
		return ErrLiveConflict
	}
	return err
}
func (r *LiveRepository) Thumbnail(ctx context.Context, s types.UserContext, id, key string) error {
	res, err := r.db.ExecContext(ctx, `UPDATE youtube_live_drafts SET thumbnail_key=$4,state=CASE WHEN state='created' THEN 'needs_attention' ELSE state END,step=CASE WHEN broadcast_id<>'' THEN 'thumbnail' ELSE step END,updated_at=NOW() WHERE id=$1 AND user_id=$2 AND client_id IS NOT DISTINCT FROM $3 AND state NOT IN ('creating','generating')`, id, s.UserID, s.ClientID, key)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err == nil && n != 1 {
		return ErrLiveConflict
	}
	return err
}
func (r *LiveRepository) Account(ctx context.Context, s types.UserContext, id int) error {
	var found int
	return r.db.QueryRowContext(ctx, `SELECT id FROM platform_accounts WHERE id=$1 AND user_id=$2 AND client_id IS NOT DISTINCT FROM $3 AND platform='youtube' AND status IN ('active','connected')`, id, s.UserID, s.ClientID).Scan(&found)
}

func (r *LiveRepository) Reconcile(ctx context.Context, s types.UserContext, d *types.LiveDraft, broadcastID, streamID string) error {
	res, err := r.db.ExecContext(ctx, `UPDATE youtube_live_drafts SET broadcast_id=$4,stream_id=$5,step='reconciled',error_summary='',updated_at=NOW() WHERE id=$1 AND user_id=$2 AND client_id IS NOT DISTINCT FROM $3 AND state='needs_attention' AND updated_at=$6`, d.ID, s.UserID, s.ClientID, broadcastID, streamID, d.UpdatedAt)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err == nil && n != 1 {
		return ErrLiveConflict
	}
	return err
}
func (r *LiveRepository) PutOAuth(ctx context.Context, s types.UserContext, hash, session string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM youtube_live_oauth_states WHERE expires_at<NOW()`)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx, `INSERT INTO youtube_live_oauth_states(token_hash,session_hash,user_id,client_id,expires_at) VALUES($1,$2,$3,$4,$5)`, hash, session, s.UserID, s.ClientID, time.Now().Add(10*time.Minute))
	return err
}
func (r *LiveRepository) ConsumeOAuth(ctx context.Context, userID int, hash, session string) (*int, error) {
	var client sql.NullInt64
	err := r.db.QueryRowContext(ctx, `DELETE FROM youtube_live_oauth_states WHERE token_hash=$1 AND session_hash=$2 AND user_id=$3 AND expires_at>NOW() RETURNING client_id`, hash, session, userID).Scan(&client)
	if err != nil {
		return nil, err
	}
	if client.Valid {
		v := int(client.Int64)
		return &v, nil
	}
	return nil, nil
}
