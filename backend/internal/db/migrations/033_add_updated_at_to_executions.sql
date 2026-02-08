-- Migration 033: Add updated_at to automation_executions
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add trigger for updated_at if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_automation_executions_updated_at') THEN
        CREATE TRIGGER update_automation_executions_updated_at
            BEFORE UPDATE ON automation_executions
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
