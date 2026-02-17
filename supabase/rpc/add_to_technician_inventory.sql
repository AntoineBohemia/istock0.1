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
  v_snapshot JSONB;
  v_snapshot_items JSONB := '[]'::JSONB;
  v_total_quantity INT := 0;
BEGIN
  -- 1. Lire l'inventaire actuel du technicien
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

  -- 2. Sauvegarder snapshot dans technician_inventory_history
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

  INSERT INTO technician_inventory_history (technician_id, snapshot)
  VALUES (
    p_technician_id,
    jsonb_build_object('items', v_snapshot_items, 'total_items', v_total_quantity)
  );

  -- 3. Pour chaque item : vérifier stock, upsert inventaire, créer mouvement, décrémenter stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Vérifier le stock avec FOR UPDATE (anti race condition)
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

    -- Upsert inventaire technicien
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
      INSERT INTO technician_inventory (technician_id, product_id, quantity)
      VALUES (p_technician_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INT);
    END IF;

    -- Créer le mouvement de stock
    INSERT INTO stock_movements (product_id, quantity, movement_type, technician_id)
    VALUES (
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INT,
      'exit_technician',
      p_technician_id
    );

    -- Décrémenter le stock du produit
    UPDATE products
    SET stock_current = stock_current - (v_item->>'quantity')::INT,
        updated_at = NOW()
    WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'items_count', jsonb_array_length(p_items),
    'previous_items_count', v_previous_items_count
  );
END;
$$;
