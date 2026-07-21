-- Correction d'un mouvement de stock par mouvement inverse.
--
-- Le mouvement fautif reste dans l'historique ; un mouvement d'annulation
-- s'ajoute et retablit le stock. On voit ainsi l'erreur ET sa correction,
-- ce qu'une modification en place ou une suppression feraient disparaitre.
--
-- Un mouvement touche jusqu'a trois tables (products.stock_current,
-- product_organization_stock, technician_inventory) : l'annulation doit
-- defaire les trois dans la meme transaction.

-- Lien vers le mouvement annule. Sert aussi de garde-fou : un mouvement deja
-- annule ne peut pas l'etre deux fois.
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS reverses_movement_id uuid REFERENCES stock_movements(id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_reverses
  ON stock_movements (reverses_movement_id)
  WHERE reverses_movement_id IS NOT NULL;

COMMENT ON COLUMN stock_movements.reverses_movement_id IS
  'Mouvement annule par celui-ci. NULL pour un mouvement ordinaire.';

DROP FUNCTION IF EXISTS reverse_stock_movement(uuid);

CREATE FUNCTION reverse_stock_movement(p_movement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mv RECORD;
  v_new RECORD;
  v_reverse_type stock_movement_type;
  v_product_name text;
  v_tech_qty int;
BEGIN
  SELECT * INTO v_mv FROM stock_movements WHERE id = p_movement_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mouvement introuvable';
  END IF;

  IF v_mv.reverses_movement_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ce mouvement est deja une correction : il ne peut pas etre annule';
  END IF;

  IF EXISTS (SELECT 1 FROM stock_movements WHERE reverses_movement_id = p_movement_id) THEN
    RAISE EXCEPTION 'Ce mouvement a deja ete annule';
  END IF;

  -- L'outillage a ses propres operations (assignation / retour) qui gerent
  -- deja les quantites : on ne double pas le mecanisme ici.
  IF v_mv.movement_type IN ('assign_equipment', 'unassign_equipment') THEN
    RAISE EXCEPTION 'Les mouvements d''outillage se corrigent depuis la fiche outil';
  END IF;

  SELECT name INTO v_product_name FROM products WHERE id = v_mv.product_id;

  -- Type inverse : une entree s'annule par une sortie, et inversement.
  -- exit_anonymous sert de sortie neutre, sans technicien.
  v_reverse_type := CASE
    WHEN v_mv.movement_type = 'entry' THEN 'exit_anonymous'::stock_movement_type
    ELSE 'entry'::stock_movement_type
  END;

  IF v_mv.movement_type = 'entry' THEN
    -- Annuler une entree retire du stock : refuser si le stock a deja ete
    -- consomme, sinon on passerait en negatif.
    IF (SELECT stock_current FROM products WHERE id = v_mv.product_id FOR UPDATE) < v_mv.quantity THEN
      RAISE EXCEPTION 'Stock insuffisant pour annuler cette entree sur "%": il a deja ete consomme', v_product_name;
    END IF;

    UPDATE products
      SET stock_current = stock_current - v_mv.quantity, updated_at = NOW()
      WHERE id = v_mv.product_id;

    UPDATE product_organization_stock
      SET stock_current = stock_current - v_mv.quantity, updated_at = NOW()
      WHERE product_id = v_mv.product_id AND organization_id = v_mv.organization_id;
  ELSE
    -- Annuler une sortie remet en stock
    UPDATE products
      SET stock_current = stock_current + v_mv.quantity, updated_at = NOW()
      WHERE id = v_mv.product_id;

    INSERT INTO product_organization_stock (product_id, organization_id, stock_current)
      VALUES (v_mv.product_id, v_mv.organization_id, v_mv.quantity)
    ON CONFLICT (product_id, organization_id)
      DO UPDATE SET stock_current = product_organization_stock.stock_current + v_mv.quantity,
                    updated_at = NOW();

    -- Sortie vers un technicien : lui reprendre ce qui lui avait ete remis
    IF v_mv.movement_type = 'exit_technician' AND v_mv.technician_id IS NOT NULL THEN
      SELECT quantity INTO v_tech_qty FROM technician_inventory
        WHERE technician_id = v_mv.technician_id AND product_id = v_mv.product_id FOR UPDATE;

      IF v_tech_qty IS NULL OR v_tech_qty < v_mv.quantity THEN
        RAISE EXCEPTION 'Le technicien ne detient plus les % unites de "%" a reprendre', v_mv.quantity, v_product_name;
      END IF;

      IF v_tech_qty = v_mv.quantity THEN
        DELETE FROM technician_inventory
          WHERE technician_id = v_mv.technician_id AND product_id = v_mv.product_id;
      ELSE
        UPDATE technician_inventory SET quantity = quantity - v_mv.quantity
          WHERE technician_id = v_mv.technician_id AND product_id = v_mv.product_id;
      END IF;
    END IF;
  END IF;

  INSERT INTO stock_movements (
    organization_id, product_id, quantity, movement_type,
    technician_id, supplier_id, unit_price, reverses_movement_id
  ) VALUES (
    v_mv.organization_id, v_mv.product_id, v_mv.quantity, v_reverse_type,
    CASE WHEN v_reverse_type = 'exit_anonymous' THEN NULL ELSE v_mv.technician_id END,
    v_mv.supplier_id, v_mv.unit_price, p_movement_id
  )
  RETURNING id, created_at INTO v_new;

  RETURN jsonb_build_object(
    'id', v_new.id,
    'created_at', v_new.created_at,
    'reverses_movement_id', p_movement_id,
    'movement_type', v_reverse_type
  );
END;
$$;

COMMENT ON FUNCTION reverse_stock_movement(uuid) IS
  'Annule un mouvement de stock par un mouvement inverse, en retablissant stock produit, stock par societe et inventaire technicien.';
