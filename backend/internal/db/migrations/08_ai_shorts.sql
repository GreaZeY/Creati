-- Migration: AI Shorts Generator Infrastructure
-- Adds support for parent-child video relationships and AI analysis caching.

ALTER TABLE videos ADD COLUMN parent_id INTEGER REFERENCES videos(id) ON DELETE CASCADE;
ALTER TABLE videos ADD COLUMN is_short BOOLEAN DEFAULT FALSE;
ALTER TABLE videos ADD COLUMN transcript JSONB;

-- Index for parent-child resolution
CREATE INDEX idx_videos_parent_id ON videos(parent_id);
