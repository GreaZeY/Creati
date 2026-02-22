-- Migration: Client invoicing for agencies using Razorpay Payment Links
CREATE TABLE IF NOT EXISTS client_invoices (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    -- Invoice details
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    amount_paise INT NOT NULL,         -- in paise (INR lowest unit)
    currency TEXT NOT NULL DEFAULT 'INR',
    -- Razorpay Payment Link
    razorpay_payment_link_id TEXT,
    razorpay_payment_link_url TEXT,
    -- Status
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'expired', 'cancelled')),
    paid_at TIMESTAMP WITH TIME ZONE,
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_invoices_user_id ON client_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_client_invoices_client_id ON client_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_client_invoices_status ON client_invoices(status);
