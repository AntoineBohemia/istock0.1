-- ============================================================================
-- Phase 2: Update RPCs to use product_organization_stock
-- All mutations now maintain both per-org stock and global cache atomically
-- ============================================================================

-- 1. create_stock_entry — adds UPSERT on product_organization_stock
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

  SELECT id, name, stock_current, price
  INTO v_product
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit non trouvé: %', p_product_id;
  END IF;

  v_price := COALESCE(p_unit_price, v_product.price);

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


-- 2. create_stock_exit — least stock first allocation via product_organization_stock
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

    IF NOT v_has_first THEN
      v_first_movement := v_movement;
      v_has_first := TRUE;
    END IF;

    UPDATE product_organization_stock
    SET stock_current = stock_current - v_take, updated_at = NOW()
    WHERE product_id = p_product_id AND organization_id = v_alloc.org_id;

    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Allocation par société incomplète pour "%": restant %',
      v_product.name, v_remaining;
  END IF;

  UPDATE products
  SET stock_current = stock_current - p_quantity,
      updated_at = NOW()
  WHERE id = p_product_id;

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


-- 3. add_to_technician_inventory — reads product_organization_stock instead of deriving from movements
CREATE OR REPLACE FUNCTION add_to_technician_inventory(
  p_technician_id UUID,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_inventory JSONB;
  v_item JSONB;
  v_product RECORD;
  v_existing RECORD;
  v_previous_items_count INT;
  v_snapshot_items JSONB := '[]'::JSONB;
  v_total_quantity INT := 0;
  v_org_id UUID;
  v_remaining INT;
  v_take INT;
  v_alloc RECORD;
  v_movements_count INT := 0;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM technicians
  WHERE id = p_technician_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Technicien non trouvé: %', p_technician_id;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', ti.id,
        'product_id', ti.product_id,
        'quantity', ti.quantity,
        'product_name', p.name,
        'product_sku', p.sku
      )
    ),
    '[]'::JSONB
  )
  INTO v_current_inventory
  FROM technician_inventory ti
  JOIN products p ON p.id = ti.product_id
  WHERE ti.technician_id = p_technician_id;

  v_previous_items_count := jsonb_array_length(v_current_inventory);

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_current_inventory)
  LOOP
    v_snapshot_items := v_snapshot_items || jsonb_build_object(
      'product_id', v_item->>'product_id',
      'product_name', v_item->>'product_name',
      'product_sku', v_item->>'product_sku',
      'quantity', (v_item->>'quantity')::INT
    );
    v_total_quantity := v_total_quantity + (v_item->>'quantity')::INT;
  END LOOP;

  INSERT INTO technician_inventory_history (technician_id, organization_id, snapshot)
  VALUES (
    p_technician_id,
    v_org_id,
    jsonb_build_object('items', v_snapshot_items, 'total_items', v_total_quantity)
  );

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, name, stock_current
    INTO v_product
    FROM products
    WHERE id = (v_item->>'product_id')::UUID
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produit non trouvé: %', v_item->>'product_id';
    END IF;

    IF v_product.stock_current < (v_item->>'quantity')::INT THEN
      RAISE EXCEPTION 'Stock insuffisant pour "%". Disponible: %, demandé: %',
        v_product.name, v_product.stock_current, (v_item->>'quantity')::INT;
    END IF;

    SELECT id, quantity
    INTO v_existing
    FROM technician_inventory
    WHERE technician_id = p_technician_id
      AND product_id = (v_item->>'product_id')::UUID;

    IF FOUND THEN
      UPDATE technician_inventory
      SET quantity = v_existing.quantity + (v_item->>'quantity')::INT
      WHERE id = v_existing.id;
    ELSE
      INSERT INTO technician_inventory (technician_id, product_id, quantity, organization_id)
      VALUES (p_technician_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INT, v_org_id);
    END IF;

    v_remaining := (v_item->>'quantity')::INT;

    FOR v_alloc IN
      SELECT pos.organization_id AS org_id, pos.stock_current AS stock
      FROM product_organization_stock pos
      JOIN organizations o ON o.id = pos.organization_id
      WHERE pos.product_id = (v_item->>'product_id')::UUID
        AND pos.stock_current > 0
      ORDER BY pos.stock_current ASC, o.name ASC
      FOR UPDATE OF pos
    LOOP
      EXIT WHEN v_remaining <= 0;

      v_take := LEAST(v_remaining, v_alloc.stock);

      INSERT INTO stock_movements (organization_id, product_id, quantity, movement_type, technician_id)
      VALUES (
        v_alloc.org_id,
        (v_item->>'product_id')::UUID,
        v_take,
        'exit_technician',
        p_technician_id
      );

      UPDATE product_organization_stock
      SET stock_current = stock_current - v_take, updated_at = NOW()
      WHERE product_id = (v_item->>'product_id')::UUID
        AND organization_id = v_alloc.org_id;

      v_remaining := v_remaining - v_take;
      v_movements_count := v_movements_count + 1;
    END LOOP;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'Allocation par société incomplète pour "%": restant %',
        v_product.name, v_remaining;
    END IF;

    UPDATE products
    SET stock_current = stock_current - (v_item->>'quantity')::INT,
        updated_at = NOW()
    WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'items_count', jsonb_array_length(p_items),
    'previous_items_count', v_previous_items_count,
    'movements_count', v_movements_count
  );
END;
$$;


-- 4. restock_technician — now uses least stock first allocation via product_organization_stock
CREATE OR REPLACE FUNCTION restock_technician(
  p_technician_id UUID,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item JSONB;
  v_product RECORD;
  v_previous_items_count INT;
  v_snapshot_items JSONB := '[]'::JSONB;
  v_total_quantity INT := 0;
  v_org_id UUID;
  v_inv RECORD;
  v_remaining INT;
  v_take INT;
  v_alloc RECORD;
  v_movements_count INT := 0;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM technicians
  WHERE id = p_technician_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Technicien non trouvé: %', p_technician_id;
  END IF;

  FOR v_inv IN
    SELECT ti.product_id, ti.quantity, p.name AS product_name, p.sku AS product_sku
    FROM technician_inventory ti
    JOIN products p ON p.id = ti.product_id
    WHERE ti.technician_id = p_technician_id
  LOOP
    v_snapshot_items := v_snapshot_items || jsonb_build_object(
      'product_id', v_inv.product_id,
      'product_name', v_inv.product_name,
      'product_sku', v_inv.product_sku,
      'quantity', v_inv.quantity
    );
    v_total_quantity := v_total_quantity + v_inv.quantity;
  END LOOP;

  v_previous_items_count := jsonb_array_length(v_snapshot_items);

  INSERT INTO technician_inventory_history (technician_id, snapshot)
  VALUES (
    p_technician_id,
    jsonb_build_object('items', v_snapshot_items, 'total_items', v_total_quantity)
  );

  DELETE FROM technician_inventory
  WHERE technician_id = p_technician_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, name, stock_current
    INTO v_product
    FROM products
    WHERE id = (v_item->>'product_id')::UUID
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produit non trouvé: %', v_item->>'product_id';
    END IF;

    IF v_product.stock_current < (v_item->>'quantity')::INT THEN
      RAISE EXCEPTION 'Stock insuffisant pour "%". Disponible: %, demandé: %',
        v_product.name, v_product.stock_current, (v_item->>'quantity')::INT;
    END IF;

    INSERT INTO technician_inventory (technician_id, product_id, quantity)
    VALUES (p_technician_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INT);

    v_remaining := (v_item->>'quantity')::INT;

    FOR v_alloc IN
      SELECT pos.organization_id AS org_id, pos.stock_current AS stock
      FROM product_organization_stock pos
      JOIN organizations o ON o.id = pos.organization_id
      WHERE pos.product_id = (v_item->>'product_id')::UUID
        AND pos.stock_current > 0
      ORDER BY pos.stock_current ASC, o.name ASC
      FOR UPDATE OF pos
    LOOP
      EXIT WHEN v_remaining <= 0;

      v_take := LEAST(v_remaining, v_alloc.stock);

      INSERT INTO stock_movements (organization_id, product_id, quantity, movement_type, technician_id)
      VALUES (
        v_alloc.org_id,
        (v_item->>'product_id')::UUID,
        v_take,
        'exit_technician',
        p_technician_id
      );

      UPDATE product_organization_stock
      SET stock_current = stock_current - v_take, updated_at = NOW()
      WHERE product_id = (v_item->>'product_id')::UUID
        AND organization_id = v_alloc.org_id;

      v_remaining := v_remaining - v_take;
      v_movements_count := v_movements_count + 1;
    END LOOP;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'Allocation par société incomplète pour "%": restant %',
        v_product.name, v_remaining;
    END IF;

    UPDATE products
    SET stock_current = stock_current - (v_item->>'quantity')::INT,
        updated_at = NOW()
    WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'items_count', jsonb_array_length(p_items),
    'previous_items_count', v_previous_items_count,
    'movements_count', v_movements_count
  );
END;
$$;
