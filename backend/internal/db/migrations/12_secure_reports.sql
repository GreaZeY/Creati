-- Migration 12: Secure Reports
-- Adds secure tokenized sharing for client analytics

ALTER TABLE clients ADD COLUMN share_token UUID DEFAULT gen_random_uuid();
ALTER TABLE clients ADD COLUMN share_enabled BOOLEAN DEFAULT FALSE;

-- Create index for fast lookup by token
CREATE UNIQUE INDEX idx_clients_share_token ON clients(share_token);

-- Backfill existing clients with tokens (though DEFAULT gen_random_uuid() handles it for new ones, existing ones might need it depending on DB version/flavor)
UPDATE clients SET share_token = gen_random_uuid() WHERE share_token IS NULL;
