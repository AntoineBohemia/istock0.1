-- 1. Add unit_price to stock_movements (nullable for backwards compat)
ALTER TABLE stock_movements ADD COLUMN unit_price NUMERIC DEFAULT NULL;

-- 2. Create product_price_history table
CREATE TABLE product_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_history_product ON product_price_history(product_id, effective_from DESC);

-- 3. RLS policies
ALTER TABLE product_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view price history of their org products"
  ON product_price_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products p
      JOIN user_organizations uo ON uo.organization_id = p.organization_id
      WHERE p.id = product_price_history.product_id
        AND uo.user_id = auth.uid()
    )
  );

-- 4. Trigger: auto-insert into price history when products.price changes
CREATE OR REPLACE FUNCTION fn_track_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.price IS DISTINCT FROM NEW.price AND NEW.price IS NOT NULL THEN
    INSERT INTO product_price_history (product_id, price, effective_from)
    VALUES (NEW.id, NEW.price, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_track_price_change
  AFTER UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION fn_track_price_change();

-- 5. Seed existing prices into history (so current products have at least one entry)
INSERT INTO product_price_history (product_id, price, effective_from, created_at)
SELECT id, price, COALESCE(created_at, now()), COALESCE(created_at, now())
FROM products
WHERE price IS NOT NULL AND archived_at IS NULL;

-- 6. Backfill unit_price on existing entry movements using current product price
UPDATE stock_movements sm
SET unit_price = p.price
FROM products p
WHERE sm.product_id = p.id
  AND sm.movement_type = 'entry'
  AND sm.unit_price IS NULL
  AND p.price IS NOT NULL;
