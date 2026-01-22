-- Automation Sync Tables

-- Create automation_rules table
CREATE TABLE IF NOT EXISTS automation_rules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    source_account_id INTEGER NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
    trigger_type TEXT NOT NULL DEFAULT 'new_upload', -- e.g., 'new_upload'
    filters JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g., {"keywords": ["vlog"], "min_duration": 60}
    targets JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of target configs: [{"account_id": 2, "caption_template": "..."}]
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create automation_jobs table to track execution
CREATE TABLE IF NOT EXISTS automation_jobs (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    video_id INTEGER REFERENCES videos(id) ON DELETE SET NULL, -- Internal video record if created
    source_platform_id TEXT NOT NULL, -- External ID (e.g., YouTube Video ID)
    target_account_id INTEGER NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
    job_id INTEGER, -- Reference to the background queue job if applicable
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_automation_rules_updated_at
    BEFORE UPDATE ON automation_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_jobs_updated_at
    BEFORE UPDATE ON automation_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_automation_rules_user_id ON automation_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_source_account ON automation_rules(source_account_id);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_rule_id ON automation_jobs(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_status ON automation_jobs(status);
