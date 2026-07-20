-- Add optional invoice reference to stock movements (entries only)
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS invoice_reference TEXT NULL;

-- The signature below gains two parameters, so CREATE OR REPLACE would NOT replace
-- the previous 5-argument function — it would add a second overload and make every
-- 5-argument call ambiguous (the exact bug that broke get_technicians_with_stats).
-- Drop the old signature first; the new one covers those calls via its defaults.
DROP FUNCTION IF EXISTS create_stock_entry(uuid, uuid, integer, uuid, numeric);

-- Update create_stock_entry RPC to accept invoice_reference + optional created_at override
CREATE OR REPLACE FUNCTION create_stock_entry(
  p_organization_id UUID,
  p_product_id UUID,
  p_quantity INT,
  p_supplier_id UUID DEFAULT NULL,
  p_unit_price NUMERIC DEFAULT NULL,
  p_invoice_reference TEXT DEFAULT NULL,
  p_created_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product RECORD;
  v_movement RECORD;
  v_price NUMERIC;
  v_created_at TIMESTAMPTZ;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'La quantité doit être positive';
  END IF;

  -- Validate optional date override
  IF p_created_at IS NOT NULL THEN
    IF p_created_at > NOW() THEN
      RAISE EXCEPTION 'La date ne peut pas être dans le futur';
    END IF;
    IF p_created_at < NOW() - INTERVAL '90 days' THEN
      RAISE EXCEPTION 'La date ne peut pas remonter à plus de 90 jours';
    END IF;
  END IF;

  v_created_at := COALESCE(p_created_at, NOW());

  SELECT id, name, stock_current, price
  INTO v_product
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit non trouvé: %', p_product_id;
  END IF;

  v_price := COALESCE(p_unit_price, v_product.price);

  INSERT INTO stock_movements (organization_id, product_id, quantity, movement_type, supplier_id, unit_price, invoice_reference, created_at)
  VALUES (p_organization_id, p_product_id, p_quantity, 'entry', p_supplier_id, v_price, p_invoice_reference, v_created_at)
  RETURNING id, product_id, quantity, movement_type, technician_id, organization_id, created_at, supplier_id, unit_price, invoice_reference
  INTO v_movement;

  -- Increment per-org stock
  INSERT INTO product_organization_stock (product_id, organization_id, stock_current)
  VALUES (p_product_id, p_organization_id, p_quantity)
  ON CONFLICT (product_id, organization_id)
  DO UPDATE SET
    stock_current = product_organization_stock.stock_current + p_quantity,
    updated_at = NOW();

  -- Increment global stock cache
  UPDATE products
  SET stock_current = stock_current + p_quantity,
      updated_at = NOW()
  WHERE id = p_product_id;

  RETURN jsonb_build_object(
    'id', v_movement.id,
    'product_id', v_movement.product_id,
    'quantity', v_movement.quantity,
    'movement_type', v_movement.movement_type,
    'technician_id', v_movement.technician_id,
    'organization_id', v_movement.organization_id,
    'created_at', v_movement.created_at,
    'supplier_id', v_movement.supplier_id,
    'unit_price', v_movement.unit_price,
    'invoice_reference', v_movement.invoice_reference
  );
END;
$$;
