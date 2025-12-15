-- Refactor MVP Labs

-- Labs table adjustments
ALTER TABLE labs
  ADD COLUMN IF NOT EXISTS owner_email TEXT,
  ADD COLUMN IF NOT EXISTS ssh_username TEXT,
  ADD COLUMN IF NOT EXISTS portainer_endpoint_id INTEGER,
  ADD COLUMN IF NOT EXISTS exposed_ports JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ALTER COLUMN status SET DEFAULT 'ACTIVO';

-- Normalize statuses
UPDATE labs SET status = 'ACTIVO' WHERE status = 'active';
UPDATE labs SET status = 'CANCELADO_POR_USUARIO' WHERE status = 'deleted';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'labs_status_check'
  ) THEN
    ALTER TABLE labs
    ADD CONSTRAINT labs_status_check CHECK (status IN ('ACTIVO','CANCELADO_POR_USUARIO','CANCELADO_POR_TIEMPO'));
  END IF;
END$$;

-- Config defaults
INSERT INTO system_config(key, value) VALUES
  ('max_labs', '20'),
  ('ssh_port_range_start', '2200'),
  ('ssh_port_range_end', '2299'),
  ('app_port_range_start', '3000'),
  ('app_port_range_end', '3099'),
  ('lab_duration_hours', '24')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Ensure indexes
CREATE INDEX IF NOT EXISTS idx_labs_user_status ON labs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_labs_status_expires ON labs(status, expires_at);
