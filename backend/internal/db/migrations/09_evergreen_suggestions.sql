-- Migration: Add suggested_posts table for Evergreen 2.0 recycling suggestions
-- These are AI-generated suggestions (not yet published) that agencies can approve.
CREATE TABLE IF NOT EXISTS suggested_posts (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id INT REFERENCES clients(id) ON DELETE CASCADE,
    video_id INT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    platform TEXT NOT NULL,
    suggested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    recycle_score FLOAT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'dismissed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_suggested_posts_user ON suggested_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_suggested_posts_client ON suggested_posts(client_id);
CREATE INDEX IF NOT EXISTS idx_suggested_posts_status ON suggested_posts(status);
