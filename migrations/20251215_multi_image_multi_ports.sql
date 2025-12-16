-- Multi imagen + multipuertos para labs

ALTER TABLE labs
  ADD COLUMN IF NOT EXISTS image TEXT;

-- Rango de puertos ampliado para soportar 5 puertos por lab (20 labs => 100 puertos)
INSERT INTO system_config(key, value) VALUES
  ('app_port_range_end', '3299')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Numero de puertos expuestos por lab (referencial)
INSERT INTO system_config(key, value) VALUES
  ('lab_exposed_ports_count', '5')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
