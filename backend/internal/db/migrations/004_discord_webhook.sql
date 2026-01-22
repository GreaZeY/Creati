-- Add Discord specific columns and platform_user_id for all platforms
ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS webhook_url TEXT;
ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS platform_user_id VARCHAR(255);

-- Ensure index for platform user lookups
CREATE INDEX IF NOT EXISTS idx_platform_accounts_platform_user ON platform_accounts(platform_user_id);
