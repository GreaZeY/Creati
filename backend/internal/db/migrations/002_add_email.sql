-- Add email column to platform_accounts to store connected account email
ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS email VARCHAR(255);
