-- Migration 014: Add NOTIFY trigger for automation_jobs updates
-- This allows real-time UI updates when job status changes (SSE)

CREATE OR REPLACE FUNCTION notify_automation_job_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Only notify if status has actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Payloads are limited in size, so we send the job ID
        -- The backend will then fetch necessary details (rule_id, user_id)
        PERFORM pg_notify('automation_job_updated', NEW.id::text);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_automation_job_updated ON automation_jobs;
CREATE TRIGGER trigger_automation_job_updated
    AFTER UPDATE ON automation_jobs
    FOR EACH ROW
    EXECUTE FUNCTION notify_automation_job_update();
