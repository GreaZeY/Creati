-- Migration 025: Add NOTIFY trigger for automation_logs
-- This allows real-time UI updates for notification jobs

CREATE OR REPLACE FUNCTION notify_automation_log_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify if status has actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Channel: automation_log_updated
        PERFORM pg_notify('automation_log_updated', NEW.id::text);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_automation_log_updated ON automation_logs;
CREATE TRIGGER trigger_automation_log_updated
    AFTER UPDATE ON automation_logs
    FOR EACH ROW
    EXECUTE FUNCTION notify_automation_log_update();
