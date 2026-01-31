-- Migration 018: Allow skeleton executions for better error tracking
-- This makes content_id nullable so we can record an execution attempt 
-- even if normalization fails.

ALTER TABLE automation_executions ALTER COLUMN content_id DROP NOT NULL;

COMMENT ON COLUMN automation_executions.content_id 
IS 'Link to canonical content. Can be NULL if normalization fails or is pending.';
