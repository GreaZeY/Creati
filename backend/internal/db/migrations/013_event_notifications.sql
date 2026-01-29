-- Migration 013: Add NOTIFY trigger for platform_events
-- This allows workers to react instantly to new events without polling

CREATE OR REPLACE FUNCTION notify_platform_event()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('platform_event_inserted', NEW.id::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_platform_event_inserted ON platform_events;
CREATE TRIGGER trigger_platform_event_inserted
    AFTER INSERT ON platform_events
    FOR EACH ROW
    EXECUTE FUNCTION notify_platform_event();

-- Also for automation_jobs to speed up those workers if needed
CREATE OR REPLACE FUNCTION notify_automation_job()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('automation_job_inserted', NEW.id::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_automation_job_inserted ON automation_jobs;
CREATE TRIGGER trigger_automation_job_inserted
    AFTER INSERT ON automation_jobs
    FOR EACH ROW
    EXECUTE FUNCTION notify_automation_job();
