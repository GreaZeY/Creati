-- Add AI credits to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_credits INTEGER DEFAULT 10;

-- Track credit usage
CREATE TABLE IF NOT EXISTS ai_credit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    action VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_credit_logs_user ON ai_credit_logs(user_id);
