-- Migration 07: Agency Pivot Features
-- Adds client brand voice context and tracking for secure intake/approvals

-- 1. Update Clients table with Brand Voice context
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_voice TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS target_audience TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS avoid_keywords TEXT;

-- 2. Create Intake Tokens table (Secure Credential Vault)
CREATE TABLE IF NOT EXISTS intake_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_intake_tokens_token ON intake_tokens(token);
CREATE INDEX IF NOT EXISTS idx_intake_tokens_client ON intake_tokens(client_id);

-- 3. Create Approval Links table (Frictionless Approval Portals)
CREATE TABLE IF NOT EXISTS approval_links (
    id SERIAL PRIMARY KEY,
    video_id INT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    decision VARCHAR(20), -- 'approved', 'rejected'
    feedback TEXT,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_approval_links_token ON approval_links(token);
CREATE INDEX IF NOT EXISTS idx_approval_links_video ON approval_links(video_id);

-- 4. Update Organizations with white-labeling fields
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS primary_color VARCHAR(20) DEFAULT '#6366f1';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subdomain VARCHAR(255) UNIQUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255) UNIQUE;

-- 5. Update Clients with extra visual fields and ownership
ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS color VARCHAR(20);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE SET NULL;

-- 6. Create Video Comments for collaborative approval
CREATE TABLE IF NOT EXISTS video_comments (
    id SERIAL PRIMARY KEY,
    video_id INT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    client_id INT REFERENCES clients(id) ON DELETE CASCADE, -- NULL if from agency
    user_id INT REFERENCES users(id) ON DELETE CASCADE,   -- NULL if from client public portal
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_video_comments_video ON video_comments(video_id);

-- 7. Analytics Views for optimized performance
DROP VIEW IF EXISTS vw_user_stats CASCADE;
CREATE OR REPLACE VIEW vw_user_stats AS
SELECT 
    v.user_id,
    v.client_id,
    COUNT(DISTINCT v.id) as total_videos,
    COALESCE(SUM(latest.views), 0) as total_views,
    COALESCE(SUM(latest.likes), 0) as total_likes,
    COALESCE(SUM(latest.comments), 0) as total_comments,
    COALESCE(SUM(latest.shares), 0) as total_shares
FROM (
    SELECT DISTINCT ON (video_id, account_id) video_id, views, likes, comments, shares
    FROM video_analytics
    ORDER BY video_id, account_id, fetched_at DESC
) latest
JOIN videos v ON latest.video_id = v.id
GROUP BY v.user_id, v.client_id;

DROP VIEW IF EXISTS vw_video_stats CASCADE;
CREATE OR REPLACE VIEW vw_video_stats AS
SELECT 
    v.id as video_id,
    v.title,
    v.created_at,
    COALESCE(SUM(latest.views), 0) as total_views,
    COALESCE(SUM(latest.likes), 0) as total_likes,
    COALESCE(SUM(latest.comments), 0) as total_comments,
    MAX(latest.fetched_at) as last_updated
FROM (
    SELECT DISTINCT ON (video_id, account_id) video_id, views, likes, comments, fetched_at
    FROM video_analytics
    ORDER BY video_id, account_id, fetched_at DESC
) latest
JOIN videos v ON latest.video_id = v.id
GROUP BY v.id, v.title, v.created_at;

-- 8. Add approval statuses context (Documentation/Reminder)
-- Existing status: 'uploaded', 'pending', 'processing', 'completed', 'failed'
-- New lifecycle statuses for agency flow: 'draft', 'pending_approval', 'approved', 'rejected'
