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
BEGIN
  -- Récupérer l'organization_id via le technicien
  SELECT organization_id INTO v_org_id
  FROM technicians
  WHERE id = p_technician_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Technicien non trouvé: %', p_technician_id;
  END IF;

  -- 1. Sauvegarder l'inventaire actuel dans technician_inventory_history
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

  -- 2. Supprimer l'inventaire actuel
  DELETE FROM technician_inventory
  WHERE technician_id = p_technician_id;

  -- 3. Insérer les nouveaux items + créer mouvements + décrémenter stock
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

    -- Insérer dans l'inventaire du technicien
    INSERT INTO technician_inventory (technician_id, product_id, quantity)
    VALUES (p_technician_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INT);

    -- Créer le mouvement de stock avec organization_id
    INSERT INTO stock_movements (organization_id, product_id, quantity, movement_type, technician_id)
    VALUES (
      v_org_id,
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
