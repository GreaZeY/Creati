-- Migration 13: Content Queue (Guest Assets + BYOS)

-- Add guest asset support to videos
ALTER TABLE videos ADD COLUMN is_guest BOOLEAN DEFAULT FALSE;
ALTER TABLE videos ADD COLUMN size_bytes BIGINT DEFAULT 0;

-- Client Drop Zone configuration
ALTER TABLE clients ADD COLUMN drop_token UUID DEFAULT gen_random_uuid();
ALTER TABLE clients ADD COLUMN drop_enabled BOOLEAN DEFAULT FALSE;
CREATE UNIQUE INDEX idx_clients_drop_token ON clients(drop_token);

-- BYO Storage Configuration per Organization
CREATE TABLE organization_storage_configs (
    id SERIAL PRIMARY KEY,
    org_id INT REFERENCES organizations(id) ON DELETE CASCADE,
    provider_type VARCHAR(50) NOT NULL, -- 's3_custom', 'gdrive', 'dropbox'
    credentials JSONB NOT NULL, -- Encrypted keys/tokens
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Organization Quota tracking (optional: could also be on subscription table)
ALTER TABLE organizations ADD COLUMN storage_used_bytes BIGINT DEFAULT 0;
ALTER TABLE organizations ADD COLUMN storage_quota_gb INT DEFAULT 1; -- Default 1GB for free
