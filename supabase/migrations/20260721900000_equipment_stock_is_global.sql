-- L'outillage n'est pas ventile par societe : retour en arriere assume.
--
-- La migration precedente faisait mouvementer product_organization_stock par
-- assign_equipment et unassign_equipment, en supposant qu'un outil appartienne
-- a une societe comme un consommable. C'est faux : un outil est attribue a un
-- technicien, pas detenu par une entreprise.
--
-- Consequence a retenir : pour les produits de type 'equipment',
-- products.stock_current ne doit PAS etre rapproche de la somme des
-- product_organization_stock. Ce n'est pas un ecart, c'est le modele.

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

  -- Stock global uniquement : l'outillage n'est pas rattache a une societe.
  UPDATE products SET stock_current = stock_current - p_quantity, updated_at = NOW()
    WHERE id = p_product_id;

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

  -- Stock global uniquement, symetrique de l'assignation.
  UPDATE products SET stock_current = stock_current + p_quantity, updated_at = NOW()
    WHERE id = p_product_id;

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

-- Ligne de stock par societe heritee d'un outil : elle n'a pas lieu d'etre
-- dans ce modele et faussait le rapprochement.
DELETE FROM product_organization_stock pos
USING products p
WHERE p.id = pos.product_id AND p.product_type = 'equipment';
