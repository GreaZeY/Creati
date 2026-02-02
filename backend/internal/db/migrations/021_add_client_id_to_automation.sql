-- Migration 021: Add Client ID to Automation Rules
-- This was missed in 019_agency_schema.sql

ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS client_id INT REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS client_id INT REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_automation_rules_client ON automation_rules(client_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_client ON automation_executions(client_id);
