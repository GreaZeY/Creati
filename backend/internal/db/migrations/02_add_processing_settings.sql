-- Add processing_settings to automation_executions to track trimming and overlays
ALTER TABLE automation_executions 
ADD COLUMN IF NOT EXISTS processing_settings JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN automation_executions.processing_settings IS 'Trimming (start/end) and overlay settings for video processing';
