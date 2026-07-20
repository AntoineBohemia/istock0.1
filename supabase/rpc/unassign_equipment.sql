-- Retire un outil assigne a un technicien et le remet en stock central.
-- Recupere depuis la base le 2026-07-20 (absent du repo jusque-la).
CREATE OR REPLACE FUNCTION public.unassign_equipment(p_organization_id uuid, p_product_id uuid, p_technician_id uuid, p_quantity integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_product RECORD;
  v_assignment RECORD;
  v_movement RECORD;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'La quantite doit etre positive';
  END IF;

  -- Lock product
  SELECT id, name, product_type
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

  -- Check assignment exists
  SELECT id, quantity
  INTO v_assignment
  FROM equipment_assignments
  WHERE product_id = p_product_id
    AND technician_id = p_technician_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cet outillage n''est pas assigne a ce technicien';
  END IF;

  IF v_assignment.quantity < p_quantity THEN
    RAISE EXCEPTION 'Quantite assignee insuffisante. Assignee: %, demandee: %',
      v_assignment.quantity, p_quantity;
  END IF;

  -- Create movement record
  INSERT INTO stock_movements (organization_id, product_id, quantity, movement_type, technician_id)
  VALUES (p_organization_id, p_product_id, p_quantity, 'unassign_equipment', p_technician_id)
  RETURNING id, product_id, quantity, movement_type, technician_id, organization_id, created_at
  INTO v_movement;

  -- Increment stock (equipment returns to central stock)
  UPDATE products
  SET stock_current = stock_current + p_quantity,
      updated_at = NOW()
  WHERE id = p_product_id;

  -- Update or delete assignment
  IF v_assignment.quantity = p_quantity THEN
    DELETE FROM equipment_assignments WHERE id = v_assignment.id;
  ELSE
    UPDATE equipment_assignments
    SET quantity = v_assignment.quantity - p_quantity
    WHERE id = v_assignment.id;
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
$function$

;
