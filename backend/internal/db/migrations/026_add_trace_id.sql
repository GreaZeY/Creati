-- Migration 026: Add trace_id for grouping related executions
-- This allows multiple executions (e.g. from a multi-target blast) to be clubbed in the UI

-- 1. Add trace_id to automation_executions if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_executions' AND column_name='trace_id') THEN
        ALTER TABLE automation_executions ADD COLUMN trace_id UUID;
    END IF;
END $$;

-- 2. Add trace_id to automation_logs (for grouped notifications)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_logs' AND column_name='trace_id') THEN
        ALTER TABLE automation_logs ADD COLUMN trace_id UUID;
    END IF;
END $$;

-- 3. Update existing records to have a trace_id (for consistency)
UPDATE automation_executions SET trace_id = gen_random_uuid() WHERE trace_id IS NULL;
UPDATE automation_logs SET trace_id = gen_random_uuid() WHERE trace_id IS NULL;

-- 4. Add indexes for grouping performance
CREATE INDEX IF NOT EXISTS idx_automation_executions_trace_id ON automation_executions(trace_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_trace_id ON automation_logs(trace_id);
