-- Migration 017: Relax constraints and add real-time NOTIFY for executions
-- This allows more flexible manual blasts and restores live dashboard updates for V2

-- 1. Relax the unique constraint on automation_executions
-- Old: UNIQUE(content_id, target_platform)
-- New: UNIQUE(rule_id, content_id, target_platform)
ALTER TABLE automation_executions 
DROP CONSTRAINT IF EXISTS automation_executions_content_id_target_platform_key;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'automation_executions_v2_unique') THEN
        ALTER TABLE automation_executions 
        ADD CONSTRAINT automation_executions_v2_unique 
        UNIQUE(rule_id, content_id, target_platform);
    END IF;
END $$;

-- 2. Add NOTIFY trigger for automation_executions status updates
CREATE OR REPLACE FUNCTION notify_automation_execution_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify if status has actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Payloads are limited in size, so we send the execution ID
        -- Channel: automation_execution_updated
        PERFORM pg_notify('automation_execution_updated', NEW.id::text);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_automation_execution_updated ON automation_executions;
CREATE TRIGGER trigger_automation_execution_updated
    AFTER UPDATE ON automation_executions
    FOR EACH ROW
    EXECUTE FUNCTION notify_automation_execution_update();

COMMENT ON CONSTRAINT automation_executions_v2_unique ON automation_executions 
IS 'Allows same content to be blasted in different rules, but prevents duplicates within the same rule';
