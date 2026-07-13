ALTER TABLE technicians
  ADD COLUMN IF NOT EXISTS vehicle_plate text,
  ADD COLUMN IF NOT EXISTS vehicle_brand text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tablet_ref text,
  ADD COLUMN IF NOT EXISTS clothing_size text;
