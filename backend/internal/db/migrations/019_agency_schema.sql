-- Migration 019: Agency Schema (Organizations, Teams, Clients)

-- 1. Create Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    owner_id INT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Clients Table (Workspaces)
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    org_id INT REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7) DEFAULT '#000000',
    logo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Team Members Table (Roles)
CREATE TABLE IF NOT EXISTS team_members (
    id SERIAL PRIMARY KEY,
    org_id INT REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'editor', -- 'owner', 'admin', 'editor', 'viewer'
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'invited'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, user_id)
);

-- 4. Link Assets to Clients (Nullable for backward compatibility)
ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS client_id INT REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS client_id INT REFERENCES clients(id) ON DELETE SET NULL;

-- 5. Indexes for Performance
CREATE INDEX idx_clients_org ON clients(org_id);
CREATE INDEX idx_team_members_org ON team_members(org_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_platform_accounts_client ON platform_accounts(client_id);
CREATE INDEX idx_videos_client ON videos(client_id);
