-- Consolidated Schema Migration (Full Bootstrap)
-- This script sets up the entire application database from scratch.

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Helper Functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 2. Principal Tables
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    owner_id INT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_members (
    id SERIAL PRIMARY KEY,
    org_id INT REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'editor', -- 'owner', 'admin', 'editor', 'viewer'
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'invited'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, user_id)
);

CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    org_id INT REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7) DEFAULT '#000000',
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_clients_org ON clients(org_id);

-- 3. Domain Tables
CREATE TABLE IF NOT EXISTS platform_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    platform VARCHAR(50) NOT NULL,
    platform_user_id VARCHAR(255) NOT NULL,
    external_account_id VARCHAR(255), -- Channel ID / Page ID
    profile_name VARCHAR(255),
    handle VARCHAR(255),
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) DEFAULT 'active',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_platform_accounts_user ON platform_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_accounts_client ON platform_accounts(client_id);
CREATE INDEX IF NOT EXISTS idx_platform_accounts_platform_user ON platform_accounts(platform, platform_user_id);
CREATE INDEX IF NOT EXISTS idx_platform_accounts_external_id ON platform_accounts(platform, external_account_id);

-- Unique constraint for client isolation (handles NULL client_id as unique bucket)
CREATE UNIQUE INDEX IF NOT EXISTS platform_accounts_client_isolation_idx 
ON platform_accounts (user_id, platform, platform_user_id, COALESCE(client_id, 0));

CREATE TABLE IF NOT EXISTS contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint VARCHAR(255) UNIQUE NOT NULL,
    origin_platform VARCHAR(50) NOT NULL,
    origin_platform_content_id VARCHAR(255) NOT NULL,
    title TEXT,
    description TEXT,
    duration_seconds INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_contents_fingerprint ON contents(fingerprint);

CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    content_id UUID REFERENCES contents(id) ON DELETE SET NULL,
    platform VARCHAR(50), 
    external_id VARCHAR(255),
    title TEXT NOT NULL,
    description TEXT,
    s3_url TEXT,
    status VARCHAR(20) DEFAULT 'uploaded',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_videos_user ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_client ON videos(client_id);
CREATE INDEX IF NOT EXISTS idx_videos_content ON videos(content_id);
CREATE INDEX IF NOT EXISTS idx_videos_external_id ON videos(platform, external_id);
CREATE INDEX IF NOT EXISTS idx_videos_user_platform_ext ON videos(user_id, platform, external_id);

CREATE TABLE IF NOT EXISTS platform_contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    platform_content_id VARCHAR(255) NOT NULL,
    account_id INT REFERENCES platform_accounts(id) ON DELETE CASCADE,
    s3_key VARCHAR(500),
    published_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform, platform_content_id),
    UNIQUE(content_id, platform)
);

-- 4. Feature Tables
CREATE TABLE IF NOT EXISTS platform_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform VARCHAR(50) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    account_id INTEGER NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending', 
    dedup_key VARCHAR(500) NOT NULL UNIQUE,
    processed_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_platform_events_account ON platform_events(account_id);
CREATE INDEX IF NOT EXISTS idx_platform_events_status ON platform_events(status);
CREATE INDEX IF NOT EXISTS idx_pending_platform_events ON platform_events(created_at DESC) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    subscription_id VARCHAR(255),
    topic_url TEXT NOT NULL,
    callback_url TEXT NOT NULL,
    secret VARCHAR(255),
    lease_expires_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending',
    last_verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, platform)
);

CREATE TABLE IF NOT EXISTS polling_state (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL UNIQUE REFERENCES platform_accounts(id) ON DELETE CASCADE,
    last_external_id VARCHAR(255),
    last_polled_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS automation_rules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    source_account_id INTEGER NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
    trigger_type TEXT NOT NULL DEFAULT 'new_upload',
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    targets JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_automation_rules_user ON automation_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_client ON automation_rules(client_id);

CREATE TABLE IF NOT EXISTS automation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    rule_id INT NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE, -- Optional but good for isolation
    client_id INT REFERENCES clients(id) ON DELETE SET NULL,
    source_platform VARCHAR(50) NOT NULL,
    target_platform VARCHAR(50) NOT NULL,
    target_account_id INT REFERENCES platform_accounts(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    trace_id UUID,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(rule_id, content_id, target_platform)
);
CREATE INDEX IF NOT EXISTS idx_executions_status ON automation_executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_client ON automation_executions(client_id);

CREATE TABLE IF NOT EXISTS automation_jobs (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    video_id INTEGER REFERENCES videos(id) ON DELETE SET NULL,
    source_platform_id TEXT NOT NULL,
    target_account_id INTEGER NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
    job_id INTEGER, 
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_rule_status ON automation_jobs(rule_id, status);

-- 5. Financial Tables
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    plan VARCHAR(50) NOT NULL DEFAULT 'free',
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    razorpay_subscription_id VARCHAR(100),
    current_period_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    current_period_end TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 month'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Analytics Tables
CREATE TABLE IF NOT EXISTS video_analytics (
    id SERIAL PRIMARY KEY,
    video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES platform_accounts(id) ON DELETE SET NULL,
    platform VARCHAR(50) NOT NULL,
    views BIGINT DEFAULT 0,
    likes BIGINT DEFAULT 0,
    comments BIGINT DEFAULT 0,
    shares BIGINT DEFAULT 0,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_analytics_video ON video_analytics(video_id);
CREATE INDEX IF NOT EXISTS idx_analytics_account ON video_analytics(account_id);

-- 7. Triggers for updated_at
CREATE TRIGGER update_platform_accounts_updated_at BEFORE UPDATE ON platform_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contents_updated_at BEFORE UPDATE ON contents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON videos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_webhook_subscriptions_updated_at BEFORE UPDATE ON webhook_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_polling_state_updated_at BEFORE UPDATE ON polling_state FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_automation_rules_updated_at BEFORE UPDATE ON automation_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_automation_jobs_updated_at BEFORE UPDATE ON automation_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Real-time Notification Triggers (SSE)
CREATE OR REPLACE FUNCTION notify_platform_event() RETURNS TRIGGER AS $$ BEGIN PERFORM pg_notify('platform_event_inserted', NEW.id::text); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_platform_event_inserted AFTER INSERT ON platform_events FOR EACH ROW EXECUTE FUNCTION notify_platform_event();

CREATE OR REPLACE FUNCTION notify_automation_execution_update() RETURNS TRIGGER AS $$ BEGIN IF OLD.status IS DISTINCT FROM NEW.status THEN PERFORM pg_notify('automation_execution_updated', NEW.id::text); END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_automation_execution_updated AFTER UPDATE ON automation_executions FOR EACH ROW EXECUTE FUNCTION notify_automation_execution_update();

CREATE OR REPLACE FUNCTION notify_automation_job_update() RETURNS TRIGGER AS $$ BEGIN IF OLD.status IS DISTINCT FROM NEW.status THEN PERFORM pg_notify('automation_job_updated', NEW.id::text); END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_automation_job_updated AFTER UPDATE ON automation_jobs FOR EACH ROW EXECUTE FUNCTION notify_automation_job_update();

-- 9. Views
CREATE OR REPLACE VIEW vw_video_stats AS
SELECT 
    v.id AS video_id,
    v.user_id,
    v.client_id,
    v.title,
    v.created_at,
    COALESCE(SUM(latest.views), 0) as total_views,
    COALESCE(SUM(latest.likes), 0) as total_likes,
    COALESCE(SUM(latest.comments), 0) as total_comments,
    COALESCE(SUM(latest.shares), 0) as total_shares,
    MAX(latest.fetched_at) as last_updated
FROM videos v
LEFT JOIN (
    SELECT DISTINCT ON (video_id, account_id) 
        video_id, account_id, views, likes, comments, shares, fetched_at
    FROM video_analytics
    ORDER BY video_id, account_id, fetched_at DESC
) latest ON v.id = latest.video_id
GROUP BY v.id, v.user_id, v.client_id, v.title, v.created_at;

CREATE OR REPLACE VIEW vw_user_stats AS
SELECT 
    user_id,
    client_id,
    COUNT(video_id) as total_videos,
    COALESCE(SUM(total_views), 0) as total_views,
    COALESCE(SUM(total_likes), 0) as total_likes,
    COALESCE(SUM(total_comments), 0) as total_comments,
    COALESCE(SUM(total_shares), 0) as total_shares
FROM vw_video_stats
GROUP BY user_id, client_id;
