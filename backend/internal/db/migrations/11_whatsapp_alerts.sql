-- 11_whatsapp_alerts.sql
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS whatsapp_alert_numbers JSONB DEFAULT '[]';

COMMENT ON COLUMN organizations.whatsapp_alert_numbers IS 'Array of failure alert recipients: [{"label": "Manager", "phone": "+91..."}, ...]';
