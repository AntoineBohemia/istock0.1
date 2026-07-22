-- Une sortie doit puiser dans le stock de la societe choisie, et d'elle seule.
--
-- create_stock_exit recevait p_organization_id sans jamais s'en servir : elle
-- parcourait toutes les societes detenant le produit, en commencant par celle
-- qui en avait le moins. SEIREN ayant toujours le plus petit stock, elle etait
-- systematiquement videe en premier — y compris quand la sortie etait demandee
-- pour SMPR, et les mouvements etaient alors attribues a SEIREN.
--
-- La repartition entre societes n'a plus lieu d'etre : le stock de chacune lui
-- appartient. On prend dans la societe demandee, et on refuse si elle n'a pas
-- de quoi servir.
--
-- Second correctif : le type 'exit_loss' etait rejete alors que l'interface
-- mobile l'envoie pour « Erreur de stock ». Aucune ligne de ce type n'a donc
-- jamais pu etre ecrite.

DROP FUNCTION IF EXISTS public.create_stock_exit(uuid, uuid, integer, text, uuid);

CREATE FUNCTION public.create_stock_exit(
  p_organization_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_type text,
  p_technician_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_product RECORD;
  v_movement RECORD;
  v_org_stock INT;
  v_existing RECORD;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'La quantité doit être positive';
  END IF;

  IF p_type NOT IN ('exit_technician', 'exit_anonymous', 'exit_loss') THEN
    RAISE EXCEPTION 'Type de sortie invalide: %', p_type;
  END IF;

  IF p_type = 'exit_technician' AND p_technician_id IS NULL THEN
    RAISE EXCEPTION 'Un technicien doit être sélectionné pour ce type de sortie';
  END IF;

  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'Une société doit être précisée pour une sortie';
  END IF;

  SELECT id, name INTO v_product
  FROM products WHERE id = p_product_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit non trouvé: %', p_product_id;
  END IF;

  -- Le stock de la societe demandee, et lui seul.
  SELECT stock_current INTO v_org_stock
  FROM product_organization_stock
  WHERE product_id = p_product_id AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND OR v_org_stock < p_quantity THEN
    RAISE EXCEPTION 'Stock insuffisant pour "%" dans cette société. Disponible: %, demandé: %',
      v_product.name, COALESCE(v_org_stock, 0), p_quantity;
  END IF;

  INSERT INTO stock_movements (organization_id, product_id, quantity, movement_type, technician_id)
  VALUES (
    p_organization_id,
    p_product_id,
    p_quantity,
    p_type::stock_movement_type,
    CASE WHEN p_type = 'exit_technician' THEN p_technician_id ELSE NULL END
  )
  RETURNING id, product_id, quantity, movement_type, technician_id, organization_id, created_at
  INTO v_movement;

  UPDATE product_organization_stock
  SET stock_current = stock_current - p_quantity, updated_at = NOW()
  WHERE product_id = p_product_id AND organization_id = p_organization_id;

  -- Cache global : somme des societes, tenu a jour pour les ecrans qui
  -- affichent encore un total tous confondus.
  UPDATE products
  SET stock_current = stock_current - p_quantity, updated_at = NOW()
  WHERE id = p_product_id;

  IF p_type = 'exit_technician' AND p_technician_id IS NOT NULL THEN
    SELECT id, quantity INTO v_existing
    FROM technician_inventory
    WHERE technician_id = p_technician_id AND product_id = p_product_id
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
    'organization_id', v_movement.organization_id,
    'created_at', v_movement.created_at
  );
END;
$function$;
