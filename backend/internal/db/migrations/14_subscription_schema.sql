-- Align legacy subscriptions with registration, entitlements, and billing handlers.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'subscriptions'
          AND column_name = 'plan_name'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'subscriptions'
          AND column_name = 'plan'
    ) THEN
        ALTER TABLE subscriptions RENAME COLUMN plan_name TO plan;
    END IF;
END $$;

ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS plan VARCHAR(100) NOT NULL DEFAULT 'free',
    ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
    ADD COLUMN IF NOT EXISTS razorpay_subscription_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE subscriptions ALTER COLUMN plan SET DEFAULT 'free';

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_razorpay_subscription_id_key
    ON subscriptions(razorpay_subscription_id);
