CREATE OR REPLACE FUNCTION create_stock_entry(
  p_organization_id UUID,
  p_product_id UUID,
  p_quantity INT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product RECORD;
  v_movement RECORD;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'La quantité doit être positive';
  END IF;

  -- Lock the product row to prevent race conditions
  SELECT id, name, stock_current
  INTO v_product
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit non trouvé: %', p_product_id;
  END IF;

  -- Create the movement
  INSERT INTO stock_movements (organization_id, product_id, quantity, movement_type, notes)
  VALUES (p_organization_id, p_product_id, p_quantity, 'entry', p_notes)
  RETURNING id, product_id, quantity, movement_type, technician_id, notes, organization_id, created_at
  INTO v_movement;

  -- Increment stock
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
    'notes', v_movement.notes,
    'organization_id', v_movement.organization_id,
    'created_at', v_movement.created_at
  );
END;
$$;
