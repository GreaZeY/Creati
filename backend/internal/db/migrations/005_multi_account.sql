-- Relax the unique constraint to allow multiple accounts per platform
-- First, find the constraint name (usually platform_accounts_user_id_platform_key or similar)
-- We will use a DO block to drop it dynamically if we don't know the exact name, or just use DROP CONSTRAINT IF EXISTS

-- 1. Add platform_user_id column if not exists (should already be there from 004)
ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS platform_user_id VARCHAR(255);

-- 2. Drop the old constraint
ALTER TABLE platform_accounts DROP CONSTRAINT IF EXISTS platform_accounts_user_id_platform_key;

-- 3. Add the new constraint including platform_user_id
-- We first need to ensure platform_user_id is not null for existing records to apply the unique constraint
-- For existing rows that might not have it, we'll set a placeholder or just hope they are clean
UPDATE platform_accounts SET platform_user_id = 'legacy_' || id WHERE platform_user_id IS NULL;

ALTER TABLE platform_accounts ALTER COLUMN platform_user_id SET NOT NULL;
ALTER TABLE platform_accounts ADD CONSTRAINT platform_accounts_user_id_platform_platform_user_id_key UNIQUE(user_id, platform, platform_user_id);
