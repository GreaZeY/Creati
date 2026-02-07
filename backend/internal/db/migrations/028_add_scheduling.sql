-- Add scheduling support to automation_jobs
ALTER TABLE automation_jobs
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS scheduled_status VARCHAR(20) DEFAULT 'immediate';

-- Index for scheduler worker query
CREATE INDEX IF NOT EXISTS idx_automation_jobs_scheduled ON automation_jobs(scheduled_status, scheduled_at) 
WHERE scheduled_status = 'scheduled';

-- Add check constraint for valid statuses
ALTER TABLE automation_jobs 
ADD CONSTRAINT IF NOT EXISTS chk_scheduled_status 
CHECK (scheduled_status IN ('immediate', 'scheduled', 'executing', 'completed', 'cancelled'));
