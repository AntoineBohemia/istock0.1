-- Une sortie ne disait jamais pourquoi.
--
-- « Erreur de stock » nomme la nature du mouvement, pas sa cause : casse,
-- perte, vol, materiel rendu inutilisable. Six mois plus tard, une ligne de
-- moins deux unites ne s'explique plus, et personne ne peut dire s'il faut
-- racheter ou reclamer.
--
-- Le manque est le plus criant sur l'outillage. Un outil ne pouvait sortir du
-- stock d'aucune facon : ni sortie, ni retrait. Casse sur chantier, il restait
-- compte indefiniment. Lui ouvrir la sortie sans pouvoir en dire la raison
-- reviendrait a effacer des unites sans trace.
--
-- Colonne nullable, aucune donnee existante touchee : les mouvements deja
-- ecrits restent sans note, ce qui est la verite — la question n'avait pas ete
-- posee au moment de leur saisie.

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS note text;

COMMENT ON COLUMN public.stock_movements.note IS
  'Motif libre du mouvement (casse, perte, vol...). Renseigne surtout pour les sorties hors technicien.';

-- create_stock_exit accepte desormais le motif.
--
-- DROP explicite : un CREATE OR REPLACE avec une signature differente cree une
-- SECONDE surcharge au lieu de remplacer, et les appels deviennent ambigus.
DROP FUNCTION IF EXISTS public.create_stock_exit(uuid, uuid, integer, text, uuid);

CREATE FUNCTION public.create_stock_exit(
  p_organization_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_type text,
  p_technician_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL
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
    'created_at', v_movement.created_at,
    'note', v_movement.note
  );
END;
$function$;

COMMENT ON FUNCTION public.create_stock_exit(uuid, uuid, integer, text, uuid, text) IS
  'Sortie de stock dans une seule société, avec motif libre optionnel. Refuse si cette société n''a pas la quantité demandée.';
