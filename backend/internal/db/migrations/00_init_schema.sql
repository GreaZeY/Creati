-- Consolidated Database Initialization for Creati
-- This file replaces 33 individual migration files with a single comprehensive schema
-- Generated: 2026-02-11

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    ai_credits INTEGER DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Creator preferences
CREATE TABLE IF NOT EXISTS creator_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    content_type VARCHAR(100),
    frequency VARCHAR(50)
);

-- ============================================================================
-- AGENCY & ORGANIZATION TABLES
-- ============================================================================

-- Organizations (Agency Mode)
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    owner_id INT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clients (Workspaces within Organizations)
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    org_id INT REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7) DEFAULT '#000000',
    logo_url TEXT,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clients_org ON clients(org_id);

-- Team Members (Roles within Organizations)
CREATE TABLE IF NOT EXISTS team_members (
    id SERIAL PRIMARY KEY,
    org_id INT REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'editor', -- 'owner', 'admin', 'editor', 'viewer'
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'invited'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_org ON team_members(org_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- ============================================================================
-- PLATFORM INTEGRATION TABLES
-- ============================================================================

-- Platform Accounts (Connected Social Media Accounts)
CREATE TABLE IF NOT EXISTS platform_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id INT REFERENCES clients(id) ON DELETE SET NULL,
    platform VARCHAR(50) NOT NULL,
    platform_user_id VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,  -- Encrypted
    refresh_token TEXT,           -- Encrypted
    expires_at TIMESTAMP WITH TIME ZONE,
    email VARCHAR(255),
    profile_name VARCHAR(255),
    handle VARCHAR(255),
    webhook_url TEXT,
    status VARCHAR(20) DEFAULT 'active',
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure client_id exists for older schemas
ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS client_id INT REFERENCES clients(id) ON DELETE SET NULL;

-- REPLACEMENT: Use Unique Index with Coalesce to handle NULL client_id (Personal Workspace)
-- This ensures ON CONFLICT works for both Personal (NULL) and Workspace (INT) accounts
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_accounts_unique_logic
    ON platform_accounts (user_id, platform, platform_user_id, (COALESCE(client_id, 0)));

CREATE INDEX IF NOT EXISTS idx_platform_accounts_user ON platform_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_accounts_client ON platform_accounts(client_id);

-- ============================================================================
-- CONTENT & VIDEO TABLES
-- ============================================================================

-- Videos (Legacy Table)
CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id INT REFERENCES clients(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    s3_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration INTEGER,
    platform_id VARCHAR(255),
    source_platform VARCHAR(50),
    status VARCHAR(20) DEFAULT 'uploaded',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_videos_user ON videos(user_id);
-- Ensure client_id exists for older schemas
ALTER TABLE videos ADD COLUMN IF NOT EXISTS client_id INT REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_videos_client ON videos(client_id);
CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created_at DESC);

-- Video Analytics
CREATE TABLE IF NOT EXISTS video_analytics (
    id SERIAL PRIMARY KEY,
    video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES platform_accounts(id) ON DELETE SET NULL,
    client_id INT REFERENCES clients(id) ON DELETE SET NULL,
    platform VARCHAR(50) NOT NULL,
    views BIGINT DEFAULT 0,
    likes BIGINT DEFAULT 0,
    comments BIGINT DEFAULT 0,
    shares BIGINT DEFAULT 0,
    watch_time_seconds BIGINT DEFAULT 0,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(video_id, platform)
);

-- Ensure client_id exists for older schemas
ALTER TABLE video_analytics ADD COLUMN IF NOT EXISTS client_id INT REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_video ON video_analytics(video_id);
CREATE INDEX IF NOT EXISTS idx_analytics_account ON video_analytics(account_id);
CREATE INDEX IF NOT EXISTS idx_analytics_client ON video_analytics(client_id);

-- Video Platform Jobs (Legacy Upload Tracking)
CREATE TABLE IF NOT EXISTS video_platform_jobs (
    id SERIAL PRIMARY KEY,
    video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES platform_accounts(id) ON DELETE SET NULL,
    platform VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    platform_id VARCHAR(255),
    retry_count INTEGER DEFAULT 0,
    error_msg TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jobs_video ON video_platform_jobs(video_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON video_platform_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_platform ON video_platform_jobs(platform);

-- ============================================================================
-- V2 CONTENT NORMALIZATION (Cycle-Proof Architecture)
-- ============================================================================

-- Canonical Content Identity (Single Source of Truth)
CREATE TABLE IF NOT EXISTS contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint VARCHAR(255) UNIQUE NOT NULL,
    origin_platform VARCHAR(50) NOT NULL,
    origin_platform_content_id VARCHAR(255) NOT NULL,
    title TEXT,
    description TEXT,
    duration_seconds INT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contents_fingerprint ON contents(fingerprint);

COMMENT ON TABLE contents IS 'Canonical content identity - single source of truth across all platforms';

-- Platform-Specific Content References (Prevents Duplicate Posts)
CREATE TABLE IF NOT EXISTS platform_contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    platform_content_id VARCHAR(255) NOT NULL,
    s3_key VARCHAR(500),
    published_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(platform, platform_content_id),
    UNIQUE(content_id, platform)  -- CYCLE KILLER: One content can only appear once per platform
);

CREATE INDEX IF NOT EXISTS idx_platform_contents_content ON platform_contents(content_id);
CREATE INDEX IF NOT EXISTS idx_platform_contents_platform ON platform_contents(platform, platform_content_id);

COMMENT ON TABLE platform_contents IS 'Platform-specific references to content - UNIQUE constraint prevents cycles';

-- ============================================================================
-- AUTOMATION SYSTEM
-- ============================================================================

-- Automation Rules
CREATE TABLE IF NOT EXISTS automation_rules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id INT REFERENCES clients(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    source_account_id INTEGER NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
    trigger_type TEXT NOT NULL DEFAULT 'new_upload',
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    targets JSONB NOT NULL DEFAULT '[]'::jsonb,
    action VARCHAR(50) DEFAULT 'sync',
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ensure client_id exists for older schemas
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS client_id INT REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_automation_rules_user_id ON automation_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_source_account ON automation_rules(source_account_id);

-- Automation Execution Tracking (Cycle-Proof by Design)
CREATE TABLE IF NOT EXISTS automation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES contents(id) ON DELETE CASCADE,
    client_id INT REFERENCES clients(id) ON DELETE SET NULL,
    rule_id INT NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    source_platform VARCHAR(50) NOT NULL,
    target_platform VARCHAR(50) NOT NULL,
    target_account_id INT REFERENCES platform_accounts(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    trace_id UUID,
    error TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    scheduled_status VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    UNIQUE(content_id, target_platform)  -- PREVENTS DUPLICATE POSTS
);

-- Ensure client_id exists for older schemas
ALTER TABLE automation_executions ADD COLUMN IF NOT EXISTS client_id INT REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_executions_status ON automation_executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_content ON automation_executions(content_id);
CREATE INDEX IF NOT EXISTS idx_executions_rule ON automation_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_executions_scheduled ON automation_executions(scheduled_at) WHERE scheduled_status = 'scheduled';

COMMENT ON TABLE automation_executions IS 'Automation execution tracking - UNIQUE constraint prevents duplicate posts';

-- Automation Logs (Activity History)
CREATE TABLE IF NOT EXISTS automation_logs (
    id SERIAL PRIMARY KEY,
    rule_id INT NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    content_id UUID REFERENCES contents(id) ON DELETE SET NULL,
    trace_id UUID,
    event VARCHAR(100) NOT NULL,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_automation_logs_rule ON automation_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_content ON automation_logs(content_id);

-- ============================================================================
-- PLATFORM EVENTS & WEBHOOKS
-- ============================================================================

-- Platform Events (Real-time Event Stream)
CREATE TABLE IF NOT EXISTS platform_events (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    external_id VARCHAR(255),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_events_account ON platform_events(account_id);
CREATE INDEX IF NOT EXISTS idx_platform_events_type ON platform_events(event_type);
-- Ensure columns exist for older schemas
ALTER TABLE platform_events ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT false;
ALTER TABLE platform_events ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_platform_events_processed ON platform_events(processed);
CREATE INDEX IF NOT EXISTS idx_platform_events_external ON platform_events(external_id);

-- Webhook Subscriptions
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    subscription_id VARCHAR(255),
    callback_url TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_account ON webhook_subscriptions(account_id);

-- Polling State (For Non-Webhook Platforms)
CREATE TABLE IF NOT EXISTS polling_state (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    last_poll_at TIMESTAMP,
    last_cursor VARCHAR(255),
    UNIQUE(account_id, platform)
);

-- ============================================================================
-- SUBSCRIPTION & PAYMENT TABLES
-- ============================================================================

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    plan_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_payment_id VARCHAR(255) UNIQUE,
    amount INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- AI CREDITS
-- ============================================================================

-- AI Credit Usage Logs
CREATE TABLE IF NOT EXISTS ai_credit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    action VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_credit_logs_user ON ai_credit_logs(user_id);

-- ============================================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger: automation_rules updated_at
DROP TRIGGER IF EXISTS update_automation_rules_updated_at ON automation_rules;
CREATE TRIGGER update_automation_rules_updated_at
    BEFORE UPDATE ON automation_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger: automation_executions updated_at
DROP TRIGGER IF EXISTS update_automation_executions_updated_at ON automation_executions;
CREATE TRIGGER update_automation_executions_updated_at
    BEFORE UPDATE ON automation_executions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- REALTIME NOTIFICATION FUNCTIONS
-- ============================================================================

-- Function: Notify on automation_executions changes
CREATE OR REPLACE FUNCTION notify_execution_change()
RETURNS TRIGGER AS $$
DECLARE
    payload JSON;
BEGIN
    payload = json_build_object(
        'id', NEW.id,
        'status', NEW.status,
        'trace_id', NEW.trace_id
    );
    PERFORM pg_notify('execution_updates', payload::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Realtime execution updates
DROP TRIGGER IF EXISTS execution_change_trigger ON automation_executions;
CREATE TRIGGER execution_change_trigger
    AFTER INSERT OR UPDATE ON automation_executions
    FOR EACH ROW
    EXECUTE FUNCTION notify_execution_change();

-- ============================================================================
-- DATA CONSTRAINTS & VALIDATION
-- ============================================================================

-- Ensure valid platform values (can be extended)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'valid_platform'
    ) THEN
        ALTER TABLE platform_accounts ADD CONSTRAINT valid_platform 
            CHECK (platform IN ('youtube', 'instagram', 'facebook', 'twitter', 'discord', 'tiktok', 'reddit', 'linkedin'));
    END IF;
END $$;

COMMENT ON DATABASE creati IS 'Creati - Multi-Platform Content Distribution System';
