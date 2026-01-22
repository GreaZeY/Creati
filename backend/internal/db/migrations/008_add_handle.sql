-- Add handle column to platform_accounts to store channel usernames/handles
ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS handle VARCHAR(255);
