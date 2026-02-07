-- Add expires_at column to platform_accounts to track token expiry
ALTER TABLE platform_accounts
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

-- Set default expiry to 1 hour from now for existing tokens
-- This is safe because the TokenSource will refresh if needed
UPDATE platform_accounts 
SET expires_at = NOW() + INTERVAL '1 hour'
WHERE expires_at IS NULL AND access_token IS NOT NULL;
