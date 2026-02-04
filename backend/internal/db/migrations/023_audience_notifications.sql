-- +migrate Up

CREATE TABLE IF NOT EXISTS audience_notification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE, -- Agency support
    name TEXT NOT NULL,
    source_platform TEXT NOT NULL CHECK (source_platform IN ('youtube', 'instagram', 'facebook', 'linkedin', 'reddit', 'twitter')), -- Expanded sources
    event_type TEXT NOT NULL DEFAULT 'upload', -- upload, publish
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audience_rules_user_client ON audience_notification_rules(user_id, client_id);
CREATE INDEX IF NOT EXISTS idx_audience_rules_enabled ON audience_notification_rules(enabled);

CREATE TABLE IF NOT EXISTS audience_notification_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES audience_notification_rules(id) ON DELETE CASCADE,
    target_platform TEXT NOT NULL CHECK (target_platform IN ('youtube_community', 'linkedin', 'instagram_story', 'discord', 'twitter', 'reddit')),
    target_identifier TEXT NOT NULL, -- channel_id, webhook_url, subreddit, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audience_targets_rule ON audience_notification_targets(rule_id);

CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES audience_notification_rules(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- Matches target_platform
    title_template TEXT, -- Template using {{title}} etc
    body_template TEXT,
    media_policy TEXT DEFAULT 'thumbnail', -- thumbnail, video_link, none
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(rule_id, platform)
);

CREATE TABLE IF NOT EXISTS audience_notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES audience_notification_rules(id) ON DELETE SET NULL,
    content_id UUID NOT NULL, -- Reference to the triggered content
    target_platform TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audience_logs_content ON audience_notification_logs(content_id);
CREATE INDEX IF NOT EXISTS idx_audience_logs_status ON audience_notification_logs(status);

-- +migrate Down
-- DROP TABLE IF EXISTS audience_notification_logs;
-- DROP TABLE IF EXISTS notification_templates;
-- DROP TABLE IF EXISTS audience_notification_targets;
-- DROP TABLE IF EXISTS audience_notification_rules;
