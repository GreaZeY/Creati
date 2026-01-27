-- Platform Events & Webhook Management
-- This migration creates the core tables for upload detection system

-- Normalized event store (event-first architecture)
CREATE TABLE IF NOT EXISTS platform_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform VARCHAR(50) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    account_id INTEGER NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending', -- pending, processed, failed
    dedup_key VARCHAR(500) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_dedup_key UNIQUE (dedup_key)
);

-- Webhook subscriptions for YouTube WebSub & Meta
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    subscription_id VARCHAR(255), -- Platform's subscription ID
    topic_url TEXT NOT NULL, -- Channel feed URL or topic
    callback_url TEXT NOT NULL,
    secret VARCHAR(255), -- HMAC secret for verification
    lease_expires_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, active, expired, failed
    last_verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_account_platform_webhook UNIQUE(account_id, platform)
);

-- Polling state for LinkedIn and other platforms without webhooks
CREATE TABLE IF NOT EXISTS polling_state (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL UNIQUE REFERENCES platform_accounts(id) ON DELETE CASCADE,
    last_external_id VARCHAR(255),
    last_polled_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_platform_events_account ON platform_events(account_id);
CREATE INDEX IF NOT EXISTS idx_platform_events_status ON platform_events(status);
CREATE INDEX IF NOT EXISTS idx_platform_events_occurred ON platform_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_events_platform_status ON platform_events(platform, status);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_account ON webhook_subscriptions(account_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_status ON webhook_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_expires ON webhook_subscriptions(lease_expires_at);

CREATE INDEX IF NOT EXISTS idx_polling_state_account ON polling_state(account_id);

-- Updated_at trigger for webhook_subscriptions
CREATE TRIGGER update_webhook_subscriptions_updated_at
    BEFORE UPDATE ON webhook_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Updated_at trigger for polling_state
CREATE TRIGGER update_polling_state_updated_at
    BEFORE UPDATE ON polling_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
