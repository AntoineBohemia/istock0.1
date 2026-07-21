-- L'outillage doit mouvementer le stock par societe, comme le reste.
--
-- assign_equipment et unassign_equipment decrementaient products.stock_current
-- sans toucher product_organization_stock. Chaque assignation creusait donc
-- l'ecart entre le stock global d'un produit et la somme de ses stocks par
-- societe : 30 unites d'ecart constatees sur 3 produits.
--
-- Toutes les autres operations (entree, sortie, correction) tiennent les deux
-- a jour. Ces deux fonctions etaient les seules a ne pas le faire.

CREATE OR REPLACE FUNCTION public.assign_equipment(
  p_organization_id uuid,
  p_product_id uuid,
  p_technician_id uuid,
  p_quantity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_product RECORD;
  v_movement RECORD;
  v_existing RECORD;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'La quantite doit etre positive';
  END IF;

  SELECT id, name, stock_current, product_type INTO v_product
    FROM products WHERE id = p_product_id FOR UPDATE;
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

  INSERT INTO stock_movements (organization_id, product_id, quantity, movement_type, technician_id)
  VALUES (p_organization_id, p_product_id, p_quantity, 'assign_equipment', p_technician_id)
  RETURNING id, product_id, quantity, movement_type, technician_id, organization_id, created_at
  INTO v_movement;

  UPDATE products SET stock_current = stock_current - p_quantity, updated_at = NOW()
    WHERE id = p_product_id;

  -- Le stock de la societe suit celui du produit
  UPDATE product_organization_stock
    SET stock_current = stock_current - p_quantity, updated_at = NOW()
    WHERE product_id = p_product_id AND organization_id = p_organization_id;

  SELECT id, quantity INTO v_existing FROM equipment_assignments
    WHERE product_id = p_product_id AND technician_id = p_technician_id FOR UPDATE;
  IF FOUND THEN
    UPDATE equipment_assignments SET quantity = v_existing.quantity + p_quantity
      WHERE id = v_existing.id;
  ELSE
    INSERT INTO equipment_assignments (product_id, technician_id, quantity, organization_id)
      VALUES (p_product_id, p_technician_id, p_quantity, p_organization_id);
  END IF;

  RETURN jsonb_build_object(
    'id', v_movement.id, 'product_id', v_movement.product_id,
    'quantity', v_movement.quantity, 'movement_type', v_movement.movement_type,
    'technician_id', v_movement.technician_id, 'organization_id', v_movement.organization_id,
    'created_at', v_movement.created_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.unassign_equipment(
  p_organization_id uuid,
  p_product_id uuid,
  p_technician_id uuid,
  p_quantity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_product RECORD;
  v_movement RECORD;
  v_existing RECORD;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'La quantite doit etre positive';
  END IF;

  SELECT id, name INTO v_product FROM products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit non trouve: %', p_product_id;
  END IF;

  SELECT id, quantity INTO v_existing FROM equipment_assignments
    WHERE product_id = p_product_id AND technician_id = p_technician_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cet outil n''est pas assigne a ce technicien';
  END IF;
  IF v_existing.quantity < p_quantity THEN
    RAISE EXCEPTION 'Le technicien ne detient que % unite(s) de "%"',
      v_existing.quantity, v_product.name;
  END IF;

  INSERT INTO stock_movements (organization_id, product_id, quantity, movement_type, technician_id)
  VALUES (p_organization_id, p_product_id, p_quantity, 'unassign_equipment', p_technician_id)
  RETURNING id, product_id, quantity, movement_type, technician_id, organization_id, created_at
  INTO v_movement;

  UPDATE products SET stock_current = stock_current + p_quantity, updated_at = NOW()
    WHERE id = p_product_id;

  -- Le stock de la societe suit celui du produit. INSERT ... ON CONFLICT :
  -- la ligne peut ne pas exister si l'outil n'avait jamais transite par la.
  INSERT INTO product_organization_stock (product_id, organization_id, stock_current)
    VALUES (p_product_id, p_organization_id, p_quantity)
  ON CONFLICT (product_id, organization_id)
    DO UPDATE SET stock_current = product_organization_stock.stock_current + p_quantity,
                  updated_at = NOW();

  IF v_existing.quantity = p_quantity THEN
    DELETE FROM equipment_assignments WHERE id = v_existing.id;
  ELSE
    UPDATE equipment_assignments SET quantity = v_existing.quantity - p_quantity
      WHERE id = v_existing.id;
  END IF;

  RETURN jsonb_build_object(
    'id', v_movement.id, 'product_id', v_movement.product_id,
    'quantity', v_movement.quantity, 'movement_type', v_movement.movement_type,
    'technician_id', v_movement.technician_id, 'organization_id', v_movement.organization_id,
    'created_at', v_movement.created_at
  );
END;
$function$;
