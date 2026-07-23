-- L'outillage se suit globalement : le stock par societe ne le concerne pas.
--
-- Bug : create_stock_entry ecrivait dans product_organization_stock pour TOUS
-- les produits, outillage compris. Or l'outillage a un stock GLOBAL
-- (products.stock_current), et assign_equipment/unassign_equipment ne touchent
-- que ce global. Les lignes par societe d'un outil, recreees a chaque achat,
-- n'etaient jamais decrementees par les affectations : elles gonflaient. Et
-- create_stock_exit validait une perte d'outil contre ces lignes gonflees, sans
-- jamais borner le global — d'ou un stock global qui pouvait passer negatif.
--
-- Correctif : l'outillage ne touche plus product_organization_stock. Entree et
-- perte agissent sur products.stock_current, qui est sa seule verite. Le
-- comportement des consommables (stock par societe) est strictement inchange.

-- ── Entree : ne pas ventiler l'outillage ──────────────────────────────
CREATE OR REPLACE FUNCTION public.create_stock_entry(
  p_organization_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_supplier_id uuid DEFAULT NULL::uuid,
  p_unit_price numeric DEFAULT NULL::numeric,
  p_invoice_reference text DEFAULT NULL::text,
  p_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_product RECORD;
  v_movement RECORD;
  v_price NUMERIC;
  v_created_at TIMESTAMPTZ;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'La quantité doit être positive';
  END IF;

  IF p_created_at IS NOT NULL THEN
    IF p_created_at > NOW() THEN
      RAISE EXCEPTION 'La date ne peut pas être dans le futur';
    END IF;
    IF p_created_at < NOW() - INTERVAL '90 days' THEN
      RAISE EXCEPTION 'La date ne peut pas remonter à plus de 90 jours';
    END IF;
  END IF;

  v_created_at := COALESCE(p_created_at, NOW());

  SELECT id, name, stock_current, price, product_type
  INTO v_product
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit non trouvé: %', p_product_id;
  END IF;

  v_price := COALESCE(p_unit_price, v_product.price);

  INSERT INTO stock_movements (organization_id, product_id, quantity, movement_type, supplier_id, unit_price, invoice_reference, created_at)
  VALUES (p_organization_id, p_product_id, p_quantity, 'entry', p_supplier_id, v_price, p_invoice_reference, v_created_at)
  RETURNING id, product_id, quantity, movement_type, technician_id, organization_id, created_at, supplier_id, unit_price, invoice_reference
  INTO v_movement;

  -- Consommable : on ventile par societe. Outillage : suivi global, on saute.
  IF v_product.product_type IS DISTINCT FROM 'equipment' THEN
    INSERT INTO product_organization_stock (product_id, organization_id, stock_current)
    VALUES (p_product_id, p_organization_id, p_quantity)
    ON CONFLICT (product_id, organization_id)
    DO UPDATE SET
      stock_current = product_organization_stock.stock_current + p_quantity,
      updated_at = NOW();
  END IF;

  -- Cache global : pour un consommable c'est un cache (somme des societes),
  -- pour un outil c'est la seule verite. Dans les deux cas il monte.
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
    'unit_price', v_movement.unit_price,
    'invoice_reference', v_movement.invoice_reference
  );
END;
$function$;

-- ── Sortie : valider l'outillage contre le stock global ───────────────
CREATE OR REPLACE FUNCTION public.create_stock_exit(
  p_organization_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_type text,
  p_technician_id uuid DEFAULT NULL::uuid,
  p_note text DEFAULT NULL::text
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

  SELECT id, name, product_type, stock_current
  INTO v_product
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit non trouvé: %', p_product_id;
  END IF;

  IF v_product.product_type = 'equipment' THEN
    -- Outillage : suivi global, pas de ventilation par societe. On valide et
    -- on decremente products.stock_current, sa seule verite.
    IF v_product.stock_current < p_quantity THEN
      RAISE EXCEPTION 'Stock insuffisant pour "%". Disponible: %, demandé: %',
        v_product.name, v_product.stock_current, p_quantity;
    END IF;
  ELSE
    -- Consommable : le stock de la societe demandee, et lui seul.
    SELECT stock_current INTO v_org_stock
    FROM product_organization_stock
    WHERE product_id = p_product_id AND organization_id = p_organization_id
    FOR UPDATE;

    IF NOT FOUND OR v_org_stock < p_quantity THEN
      RAISE EXCEPTION 'Stock insuffisant pour "%" dans cette société. Disponible: %, demandé: %',
        v_product.name, COALESCE(v_org_stock, 0), p_quantity;
    END IF;
  END IF;

  INSERT INTO stock_movements (organization_id, product_id, quantity, movement_type, technician_id, note)
  VALUES (
    p_organization_id,
    p_product_id,
    p_quantity,
    p_type::stock_movement_type,
    CASE WHEN p_type = 'exit_technician' THEN p_technician_id ELSE NULL END,
    NULLIF(btrim(COALESCE(p_note, '')), '')
  )
  RETURNING id, product_id, quantity, movement_type, technician_id, organization_id, created_at, note
  INTO v_movement;

  -- Consommable seulement : la ventilation par societe baisse.
  IF v_product.product_type IS DISTINCT FROM 'equipment' THEN
    UPDATE product_organization_stock
    SET stock_current = stock_current - p_quantity, updated_at = NOW()
    WHERE product_id = p_product_id AND organization_id = p_organization_id;
  END IF;

  -- Cache global : baisse dans tous les cas (seule verite pour l'outillage).
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
    'created_at', v_movement.created_at,
    'note', v_movement.note
  );
END;
$function$;

-- Note : correction de LOGIQUE uniquement (aucune donnee touchee). Les
-- eventuelles lignes par societe deja presentes pour un outil ne genent plus —
-- l'entree ne les alimente plus et la sortie valide contre le stock global.
