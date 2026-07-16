CREATE OR REPLACE FUNCTION create_stock_exit(
  p_organization_id UUID,
  p_product_id UUID,
  p_quantity INT,
  p_type TEXT,
  p_technician_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product RECORD;
  v_movement RECORD;
  v_first_movement RECORD;
  v_existing RECORD;
  v_alloc RECORD;
  v_remaining INT;
  v_take INT;
  v_has_first BOOLEAN := FALSE;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'La quantité doit être positive';
  END IF;

  IF p_type NOT IN ('exit_technician', 'exit_anonymous') THEN
    RAISE EXCEPTION 'Type de sortie invalide: %', p_type;
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

  -- Allocate from orgs with least stock first
  v_remaining := p_quantity;

  FOR v_alloc IN
    SELECT pos.organization_id AS org_id, pos.stock_current AS stock
    FROM product_organization_stock pos
    JOIN organizations o ON o.id = pos.organization_id
    WHERE pos.product_id = p_product_id AND pos.stock_current > 0
    ORDER BY pos.stock_current ASC, o.name ASC
    FOR UPDATE OF pos
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_take := LEAST(v_remaining, v_alloc.stock);

    -- Create one movement per org allocation
    INSERT INTO stock_movements (organization_id, product_id, quantity, movement_type, technician_id)
    VALUES (
      v_alloc.org_id,
      p_product_id,
      v_take,
      p_type,
      CASE WHEN p_type = 'exit_technician' THEN p_technician_id ELSE NULL END
    )
    RETURNING id, product_id, quantity, movement_type, technician_id, organization_id, created_at
    INTO v_movement;

    -- Keep first movement for return value
    IF NOT v_has_first THEN
      v_first_movement := v_movement;
      v_has_first := TRUE;
    END IF;

    -- Decrement per-org stock
    UPDATE product_organization_stock
    SET stock_current = stock_current - v_take, updated_at = NOW()
    WHERE product_id = p_product_id AND organization_id = v_alloc.org_id;

    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Allocation par société incomplète pour "%": restant %',
      v_product.name, v_remaining;
  END IF;

  -- Decrement global stock cache
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
    'id', v_first_movement.id,
    'product_id', v_first_movement.product_id,
    'quantity', p_quantity,
    'movement_type', v_first_movement.movement_type,
    'technician_id', v_first_movement.technician_id,
    'organization_id', v_first_movement.organization_id,
    'created_at', v_first_movement.created_at
  );
END;
$$;
