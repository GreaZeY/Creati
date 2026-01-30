-- Migration 016: Content Normalization & Cycle-Proof Automation
-- Introduces canonical content identity and prevents distribution cycles

-- Canonical content identity (single source of truth)
CREATE TABLE contents (
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

-- Platform-specific content references (prevents duplicate posts)
CREATE TABLE platform_contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    platform_content_id VARCHAR(255) NOT NULL,
    account_id INT REFERENCES platform_accounts(id),
    s3_key VARCHAR(500),
    published_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(platform, platform_content_id),
    UNIQUE(content_id, platform)  -- CYCLE KILLER: One content can only appear once per platform
);

-- Automation execution tracking (cycle-proof by design)
CREATE TABLE automation_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    rule_id INT NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
    source_platform VARCHAR(50) NOT NULL,
    target_platform VARCHAR(50) NOT NULL,
    target_account_id INT REFERENCES platform_accounts(id),
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    trace_id UUID,
    error TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    
    UNIQUE(content_id, target_platform)  -- PREVENTS DUPLICATE POSTS: Same content can't be posted to same platform twice
);

-- Indexes for performance
CREATE INDEX idx_contents_fingerprint ON contents(fingerprint);
CREATE INDEX idx_platform_contents_content ON platform_contents(content_id);
CREATE INDEX idx_platform_contents_platform ON platform_contents(platform, platform_content_id);
CREATE INDEX idx_executions_status ON automation_executions(status);
CREATE INDEX idx_executions_content ON automation_executions(content_id);
CREATE INDEX idx_executions_rule ON automation_executions(rule_id);

COMMENT ON TABLE contents IS 'Canonical content identity - single source of truth across all platforms';
COMMENT ON TABLE platform_contents IS 'Platform-specific references to content - UNIQUE constraint prevents cycles';
COMMENT ON TABLE automation_executions IS 'Automation execution tracking - UNIQUE constraint prevents duplicate posts';
