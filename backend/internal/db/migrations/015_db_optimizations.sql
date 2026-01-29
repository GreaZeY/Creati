-- Migration 015: Database Performance Optimizations
-- These indices address potential bottlenecks found during the scalability audit

-- 1. Partial index for pending events
-- Most platform_events will be processed. We only care about the tiny % of pending ones.
CREATE INDEX IF NOT EXISTS idx_pending_platform_events 
ON platform_events(created_at DESC) 
WHERE status = 'pending';

-- 2. Compound index for automation job summaries
-- Speeds up the /rules/:id/summary endpoint used by the real-time dashboard
CREATE INDEX IF NOT EXISTS idx_automation_jobs_rule_status 
ON automation_jobs(rule_id, status);

-- 3. Dedicated dedup index for video lookup
-- Used by EventProcessor to check if a video already exists before creating a duplicate
-- We include user_id to ensure fast lookup within a user's scope
CREATE INDEX IF NOT EXISTS idx_videos_user_platform_ext
ON videos(user_id, platform, external_id);
