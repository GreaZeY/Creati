CREATE TABLE IF NOT EXISTS youtube_live_preferences (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    settings JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS youtube_live_preferences_personal
    ON youtube_live_preferences(user_id) WHERE client_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS youtube_live_preferences_workspace
    ON youtube_live_preferences(user_id, client_id) WHERE client_id IS NOT NULL;
