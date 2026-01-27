-- Extend platform_accounts for webhook management
-- Adds fields needed to store platform-specific account identifiers and metadata

ALTER TABLE platform_accounts
ADD COLUMN IF NOT EXISTS external_account_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE;

-- Index for quick lookups by external ID
CREATE INDEX IF NOT EXISTS idx_platform_accounts_external_id ON platform_accounts(platform, external_account_id);

-- Comments for clarity
COMMENT ON COLUMN platform_accounts.external_account_id IS 'Platform-specific account identifier (e.g., YouTube channel ID, Instagram user ID)';
COMMENT ON COLUMN platform_accounts.metadata IS 'Flexible storage for platform-specific data (e.g., username, display name, capabilities)';
COMMENT ON COLUMN platform_accounts.last_sync_at IS 'Last time we successfully synced/polled content from this account';
