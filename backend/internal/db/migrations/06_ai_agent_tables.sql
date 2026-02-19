-- Migration: 06_ai_agent_tables.sql
-- Description: Tables for Creati AI Agent (Conversations & Tool Auditing)

-- 1. Conversations Table
CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    messages JSONB DEFAULT '[]'::jsonb, -- Array of {role: "user"|"assistant", content: "...", timestamp: "..."}
    context JSONB DEFAULT '{}'::jsonb,  -- Current user/workspace context snapshot
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id);

-- 2. Agent Audit Table (Tracking tool usage)
CREATE TABLE IF NOT EXISTS ai_agent_audit (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
    tool_name VARCHAR(100) NOT NULL,
    arguments JSONB,
    status VARCHAR(20) DEFAULT 'success', -- 'success', 'error', 'refused'
    error_msg TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_audit_user ON ai_agent_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_tool ON ai_agent_audit(tool_name);

-- 3. Add AI Agent Preferences to User
ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_preference JSONB DEFAULT '{
    "personality": "helpful",
    "voice_enabled": false,
    "proactive_tips": true
}'::jsonb;
