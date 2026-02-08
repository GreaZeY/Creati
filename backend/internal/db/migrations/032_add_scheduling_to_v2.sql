-- Migration 032: Add scheduling to automation_executions
-- Porting scheduling features from legacy automation_jobs

ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS scheduled_status VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_executions_scheduled ON automation_executions(scheduled_at) WHERE scheduled_status = 'scheduled';
