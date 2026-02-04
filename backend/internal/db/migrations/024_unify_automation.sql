-- Migration to unify automation and audience notification tables

-- 1. Add 'action' column to automation_rules
ALTER TABLE automation_rules ADD COLUMN action VARCHAR(50) DEFAULT 'sync';

-- 2. Add 'metadata' column for extra info (like templates)
ALTER TABLE automation_rules ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;

-- 3. Update existing rules to have 'action' = 'sync'
UPDATE automation_rules SET action = 'sync' WHERE action IS NULL;

-- 4. (Optional) Create a bridge for legacy notification templates if needed
-- For now, we will link new 'notify' rules directly to the automation_rules table.
