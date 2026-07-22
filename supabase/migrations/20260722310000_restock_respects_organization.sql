-- Un reapprovisionnement de technicien doit puiser dans le stock de SA societe.
--
-- restock_technician lisait bien la societe du technicien (v_org_id) mais ne
-- s'en servait jamais : elle repartissait le prelevement sur toutes les
-- societes detenant le produit, en commencant par celle qui en avait le moins.
-- Reapprovisionner un technicien SMPR vidait donc SEIREN en premier, et les
-- mouvements etaient attribues a SEIREN.
--
-- Le controle de disponibilite portait par ailleurs sur products.stock_current,
-- c'est-a-dire le total toutes societes : il laissait passer une demande que
-- la societe du technicien ne pouvait pas honorer, et l'echec ne survenait
-- qu'ensuite, sur l'allocation.

CREATE OR REPLACE FUNCTION public.restock_technician(p_technician_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_item JSONB;
  v_product RECORD;
  v_previous_items_count INT;
  v_snapshot_items JSONB := '[]'::JSONB;
  v_total_quantity INT := 0;
  v_org_id UUID;
  v_inv RECORD;
  v_qty INT;
  v_org_stock INT;
  v_movements_count INT := 0;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM technicians
  WHERE id = p_technician_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Technicien non trouvé: %', p_technician_id;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Le technicien n''est rattaché à aucune société';
  END IF;

  -- Photographie de l'inventaire avant remise a zero
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
    v_qty := (v_item->>'quantity')::INT;

    SELECT id, name INTO v_product
    FROM products
    WHERE id = (v_item->>'product_id')::UUID
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produit non trouvé: %', v_item->>'product_id';
    END IF;

    -- Disponibilite jugee sur le stock de la societe du technicien, pas sur
    -- le total toutes societes.
    SELECT stock_current INTO v_org_stock
    FROM product_organization_stock
    WHERE product_id = (v_item->>'product_id')::UUID
      AND organization_id = v_org_id
    FOR UPDATE;

    IF NOT FOUND OR v_org_stock < v_qty THEN
      RAISE EXCEPTION 'Stock insuffisant pour "%" dans la société du technicien. Disponible: %, demandé: %',
        v_product.name, COALESCE(v_org_stock, 0), v_qty;
    END IF;

    INSERT INTO technician_inventory (technician_id, product_id, quantity)
    VALUES (p_technician_id, (v_item->>'product_id')::UUID, v_qty);

    INSERT INTO stock_movements (organization_id, product_id, quantity, movement_type, technician_id)
    VALUES (v_org_id, (v_item->>'product_id')::UUID, v_qty, 'exit_technician', p_technician_id);

    UPDATE product_organization_stock
    SET stock_current = stock_current - v_qty, updated_at = NOW()
    WHERE product_id = (v_item->>'product_id')::UUID
      AND organization_id = v_org_id;

    UPDATE products
    SET stock_current = stock_current - v_qty, updated_at = NOW()
    WHERE id = (v_item->>'product_id')::UUID;

    v_movements_count := v_movements_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'items_count', jsonb_array_length(p_items),
    'previous_items_count', v_previous_items_count,
    'movements_count', v_movements_count
  );
END;
$function$;
