-- Assigne un outil (product_type = 'equipment') a un technicien.
-- Recupere depuis la base le 2026-07-20 : la fonction existait en production
-- mais son code n'etait present dans aucune migration ni fichier du repo.
CREATE OR REPLACE FUNCTION public.assign_equipment(
  p_organization_id uuid,
  p_product_id uuid,
  p_technician_id uuid,
  p_quantity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_product RECORD;
  v_movement RECORD;
  v_existing RECORD;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'La quantite doit etre positive';
  END IF;

  -- Lock and verify product is equipment type
  SELECT id, name, stock_current, product_type
  INTO v_product
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit non trouve: %', p_product_id;
  END IF;

  IF v_product.product_type != 'equipment' THEN
    RAISE EXCEPTION 'Ce produit n''est pas un outillage: %', v_product.name;
  END IF;

  IF v_product.stock_current < p_quantity THEN
    RAISE EXCEPTION 'Stock insuffisant pour "%". Disponible: %, demande: %',
      v_product.name, v_product.stock_current, p_quantity;
  END IF;

  -- Create movement record
  INSERT INTO stock_movements (organization_id, product_id, quantity, movement_type, technician_id)
  VALUES (p_organization_id, p_product_id, p_quantity, 'assign_equipment', p_technician_id)
  RETURNING id, product_id, quantity, movement_type, technician_id, organization_id, created_at
  INTO v_movement;

  -- Decrement stock (equipment leaves central stock)
  UPDATE products
  SET stock_current = stock_current - p_quantity,
      updated_at = NOW()
  WHERE id = p_product_id;

  -- Upsert equipment assignment
  SELECT id, quantity
  INTO v_existing
  FROM equipment_assignments
  WHERE product_id = p_product_id
    AND technician_id = p_technician_id
  FOR UPDATE;

  IF FOUND THEN
    UPDATE equipment_assignments
    SET quantity = v_existing.quantity + p_quantity
    WHERE id = v_existing.id;
  ELSE
    INSERT INTO equipment_assignments (product_id, technician_id, quantity, organization_id)
    VALUES (p_product_id, p_technician_id, p_quantity, p_organization_id);
  END IF;

  RETURN jsonb_build_object(
    'id', v_movement.id,
    'product_id', v_movement.product_id,
    'quantity', v_movement.quantity,
    'movement_type', v_movement.movement_type,
    'technician_id', v_movement.technician_id,
    'organization_id', v_movement.organization_id,
    'created_at', v_movement.created_at
  );
END;
$function$;
