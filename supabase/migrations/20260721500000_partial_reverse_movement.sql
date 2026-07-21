-- Correction partielle d'un mouvement.
--
-- La premiere version annulait tout ou rien. Or l'erreur la plus courante
-- porte sur la quantite : saisir 40 au lieu de 4. Annuler 40 puis ressaisir 4
-- fait deux ecritures la ou une correction de 36 suffit.
--
-- Plusieurs corrections partielles sont possibles sur un meme mouvement, tant
-- que leur somme ne depasse pas la quantite d'origine.

DROP FUNCTION IF EXISTS reverse_stock_movement(uuid);

CREATE FUNCTION reverse_stock_movement(p_movement_id uuid, p_quantity integer DEFAULT NULL)
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
  v_already int;
  v_qty int;
BEGIN
  SELECT * INTO v_mv FROM stock_movements WHERE id = p_movement_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mouvement introuvable';
  END IF;

  IF v_mv.reverses_movement_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ce mouvement est deja une correction : il ne peut pas etre annule';
  END IF;

  IF v_mv.movement_type IN ('assign_equipment', 'unassign_equipment') THEN
    RAISE EXCEPTION 'Les mouvements d''outillage se corrigent depuis la fiche de l''outil';
  END IF;

  -- Quantite deja corrigee : plusieurs corrections partielles peuvent
  -- s'additionner, mais jamais au-dela du mouvement d'origine.
  SELECT COALESCE(SUM(quantity), 0) INTO v_already
    FROM stock_movements WHERE reverses_movement_id = p_movement_id;

  v_qty := COALESCE(p_quantity, v_mv.quantity - v_already);

  IF v_qty <= 0 THEN
    RAISE EXCEPTION 'La quantite a corriger doit etre positive';
  END IF;

  IF v_already + v_qty > v_mv.quantity THEN
    RAISE EXCEPTION 'Correction impossible : % deja corrigee(s) sur %, il reste % unite(s)',
      v_already, v_mv.quantity, v_mv.quantity - v_already;
  END IF;

  SELECT name INTO v_product_name FROM products WHERE id = v_mv.product_id;

  v_reverse_type := CASE
    WHEN v_mv.movement_type = 'entry' THEN 'exit_anonymous'::stock_movement_type
    ELSE 'entry'::stock_movement_type
  END;

  IF v_mv.movement_type = 'entry' THEN
    IF (SELECT stock_current FROM products WHERE id = v_mv.product_id FOR UPDATE) < v_qty THEN
      RAISE EXCEPTION 'Stock insuffisant pour corriger cette entree sur "%": il a deja ete consomme', v_product_name;
    END IF;

    UPDATE products
      SET stock_current = stock_current - v_qty, updated_at = NOW()
      WHERE id = v_mv.product_id;

    UPDATE product_organization_stock
      SET stock_current = stock_current - v_qty, updated_at = NOW()
      WHERE product_id = v_mv.product_id AND organization_id = v_mv.organization_id;
  ELSE
    UPDATE products
      SET stock_current = stock_current + v_qty, updated_at = NOW()
      WHERE id = v_mv.product_id;

    INSERT INTO product_organization_stock (product_id, organization_id, stock_current)
      VALUES (v_mv.product_id, v_mv.organization_id, v_qty)
    ON CONFLICT (product_id, organization_id)
      DO UPDATE SET stock_current = product_organization_stock.stock_current + v_qty,
                    updated_at = NOW();

    IF v_mv.movement_type = 'exit_technician' AND v_mv.technician_id IS NOT NULL THEN
      SELECT quantity INTO v_tech_qty FROM technician_inventory
        WHERE technician_id = v_mv.technician_id AND product_id = v_mv.product_id FOR UPDATE;

      IF v_tech_qty IS NULL OR v_tech_qty < v_qty THEN
        RAISE EXCEPTION 'Le technicien ne detient plus les % unite(s) de "%" a reprendre', v_qty, v_product_name;
      END IF;

      IF v_tech_qty = v_qty THEN
        DELETE FROM technician_inventory
          WHERE technician_id = v_mv.technician_id AND product_id = v_mv.product_id;
      ELSE
        UPDATE technician_inventory SET quantity = quantity - v_qty
          WHERE technician_id = v_mv.technician_id AND product_id = v_mv.product_id;
      END IF;
    END IF;
  END IF;

  INSERT INTO stock_movements (
    organization_id, product_id, quantity, movement_type,
    technician_id, supplier_id, unit_price, reverses_movement_id
  ) VALUES (
    v_mv.organization_id, v_mv.product_id, v_qty, v_reverse_type,
    CASE WHEN v_reverse_type = 'exit_anonymous' THEN NULL ELSE v_mv.technician_id END,
    v_mv.supplier_id, v_mv.unit_price, p_movement_id
  )
  RETURNING id, created_at INTO v_new;

  RETURN jsonb_build_object(
    'id', v_new.id,
    'created_at', v_new.created_at,
    'reverses_movement_id', p_movement_id,
    'quantity', v_qty,
    'remaining', v_mv.quantity - v_already - v_qty
  );
END;
$$;

COMMENT ON FUNCTION reverse_stock_movement(uuid, integer) IS
  'Corrige tout ou partie d''un mouvement par un mouvement inverse. Sans quantite, corrige le solde restant.';
