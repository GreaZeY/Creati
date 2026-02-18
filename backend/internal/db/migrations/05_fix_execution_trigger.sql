-- Simplify execution change trigger to only send the UUID string
-- This avoids JSON/UUID string mismatch in the background worker

CREATE OR REPLACE FUNCTION notify_execution_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Send only the ID string as the payload
    PERFORM pg_notify('execution_updates', NEW.id::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Notification for logs (already exists, but ensuring consistency)
CREATE OR REPLACE FUNCTION notify_log_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('automation_log_updated', NEW.id::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS log_change_trigger ON automation_logs;
CREATE TRIGGER log_change_trigger
    AFTER INSERT ON automation_logs
    FOR EACH ROW
    EXECUTE FUNCTION notify_log_change();
