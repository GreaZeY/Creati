CREATE TABLE IF NOT EXISTS youtube_live_drafts (
    id UUID PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    idea TEXT NOT NULL,
    context TEXT NOT NULL DEFAULT '',
    package JSONB,
    questions JSONB NOT NULL DEFAULT '[]',
    state TEXT NOT NULL DEFAULT 'draft',
    step TEXT NOT NULL DEFAULT '',
    approved_event JSONB,
    broadcast_id TEXT NOT NULL DEFAULT '',
    stream_id TEXT NOT NULL DEFAULT '',
    thumbnail_key TEXT NOT NULL DEFAULT '',
    error_summary TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS youtube_live_drafts_owner ON youtube_live_drafts(user_id, client_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS youtube_live_oauth_states (
    token_hash TEXT PRIMARY KEY,
    session_hash TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
);
