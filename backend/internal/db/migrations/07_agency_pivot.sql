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

-- 4. Add approval statuses to videos
-- Existing status: 'uploaded', 'pending', 'processing', 'completed', 'failed'
-- New lifecycle statuses for agency flow: 'draft', 'pending_approval', 'approved', 'rejected'
-- Note: 'pending' in legacy might be confused with 'pending_approval', 
-- but we will use 'pending_approval' specifically for client feedback cycles.
