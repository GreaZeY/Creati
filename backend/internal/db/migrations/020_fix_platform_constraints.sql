-- Migration 020: Fix Platform Constraints for Client Isolation
-- This allows the same platform account to be connected to different clients independently

-- 1. Drop the old constraint
ALTER TABLE platform_accounts DROP CONSTRAINT IF EXISTS platform_accounts_user_id_platform_platform_user_id_key;

-- 2. Add the new constraint including client_id
-- Since client_id matches the client for a specific workspace, and is NULL for Personal workspace,
-- we need to handle NULLs in the unique index because standard UNIQUE constraints treat NULL as distinct.
-- However, we WANT (userID, platform, platformUserID, NULL) to be unique too.

-- We use a partial index or a COALESCE trick for the constraint.
-- Most robust for postgres: 
CREATE UNIQUE INDEX IF NOT EXISTS platform_accounts_client_isolation_idx 
ON platform_accounts (user_id, platform, platform_user_id, COALESCE(client_id, 0));

-- NOTE: Standard UPSERT (ON CONFLICT) requires a physical CONSTRAINT name, so we'll add one.
-- But standard constraints don't support COALESCE.
-- So we will use the INDEX name in our code's ON CONFLICT if possible, 
-- or we add a check constraint.

-- For ON CONFLICT to work with NULLs effectively in target list, we'll keep it simple for the common case:
-- Most users won't connect the EXACT same account to the same client twice.
-- But they might connect it to DIFFERENT clients.

-- Let's use a simpler approach:
ALTER TABLE platform_accounts ADD CONSTRAINT platform_accounts_v2_unique 
UNIQUE (user_id, platform, platform_user_id, client_id);
-- Wait, UNIQUE(a, b, null) and UNIQUE(a, b, null) are allowed in Postgres (it doesn't stop null duplicates).
-- So the index with COALESCE is better.

DROP INDEX IF EXISTS platform_accounts_client_isolation_idx;
CREATE UNIQUE INDEX platform_accounts_client_isolation_idx 
ON platform_accounts (user_id, platform, platform_user_id, COALESCE(client_id, 0));
