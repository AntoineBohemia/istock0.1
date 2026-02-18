CREATE OR REPLACE FUNCTION create_stock_exit(
  p_organization_id UUID,
  p_product_id UUID,
  p_quantity INT,
  p_type TEXT,
  p_technician_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product RECORD;
  v_movement RECORD;
  v_existing RECORD;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'La quantité doit être positive';
  END IF;

  IF p_type NOT IN ('exit_technician', 'exit_anonymous', 'exit_loss') THEN
    RAISE EXCEPTION 'Type de mouvement invalide: %', p_type;
  END IF;

  IF p_type = 'exit_technician' AND p_technician_id IS NULL THEN
    RAISE EXCEPTION 'Un technicien doit être sélectionné pour ce type de sortie';
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

  IF v_product.stock_current < p_quantity THEN
    RAISE EXCEPTION 'Stock insuffisant pour "%". Disponible: %, demandé: %',
      v_product.name, v_product.stock_current, p_quantity;
  END IF;

  -- Create the movement
  INSERT INTO stock_movements (organization_id, product_id, quantity, movement_type, technician_id, notes)
  VALUES (
    p_organization_id,
    p_product_id,
    p_quantity,
    p_type,
    CASE WHEN p_type = 'exit_technician' THEN p_technician_id ELSE NULL END,
    p_notes
  )
  RETURNING id, product_id, quantity, movement_type, technician_id, notes, organization_id, created_at
  INTO v_movement;

  -- Decrement stock
  UPDATE products
  SET stock_current = stock_current - p_quantity,
      updated_at = NOW()
  WHERE id = p_product_id;

  -- If exit to technician, upsert technician inventory
  IF p_type = 'exit_technician' AND p_technician_id IS NOT NULL THEN
    SELECT id, quantity
    INTO v_existing
    FROM technician_inventory
    WHERE technician_id = p_technician_id
      AND product_id = p_product_id
    FOR UPDATE;

    IF FOUND THEN
      UPDATE technician_inventory
      SET quantity = v_existing.quantity + p_quantity
      WHERE id = v_existing.id;
    ELSE
      INSERT INTO technician_inventory (technician_id, product_id, quantity)
      VALUES (p_technician_id, p_product_id, p_quantity);
    END IF;
  END IF;

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
