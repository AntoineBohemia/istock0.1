CREATE OR REPLACE FUNCTION create_stock_entry(
  p_organization_id UUID,
  p_product_id UUID,
  p_quantity INT,
  p_supplier_id UUID DEFAULT NULL,
  p_unit_price NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product RECORD;
  v_movement RECORD;
  v_price NUMERIC;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'La quantité doit être positive';
  END IF;

  -- Lock the product row to prevent race conditions
  SELECT id, name, stock_current, price
  INTO v_product
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit non trouvé: %', p_product_id;
  END IF;

  -- Use provided price or fallback to current product price
  v_price := COALESCE(p_unit_price, v_product.price);

  -- Create the movement with unit_price
  INSERT INTO stock_movements (organization_id, product_id, quantity, movement_type, supplier_id, unit_price)
  VALUES (p_organization_id, p_product_id, p_quantity, 'entry', p_supplier_id, v_price)
  RETURNING id, product_id, quantity, movement_type, technician_id, organization_id, created_at, supplier_id, unit_price
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
    'unit_price', v_movement.unit_price
  );
END;
$$;
