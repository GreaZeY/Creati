-- Migration 022: Add display_order to clients for user-preferred ordering

ALTER TABLE clients ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_clients_display_order ON clients(display_order);

-- Set initial display_order based on creation order
UPDATE clients SET display_order = id WHERE display_order = 0;
