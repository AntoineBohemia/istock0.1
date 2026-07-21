-- Regle metier : l'outillage ne compte jamais dans les totaux.
--
-- Il reste visible dans les mouvements et dans le tableau des achats, avec sa
-- pastille, mais il n'entre ni dans la somme des achats ni dans la valeur de
-- stock. Un outil est un investissement, pas une consommation.
DROP FUNCTION IF EXISTS get_purchases_by_category(integer, uuid, text);

CREATE FUNCTION get_purchases_by_category(
  p_year integer,
  p_organization_id uuid DEFAULT NULL,
  p_mode text DEFAULT 'purchases'
)
RETURNS TABLE (category_name text, total numeric, quantity bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE(c.name, 'Sans catégorie') AS category_name,
    SUM(
      (m.quantity - m.reversed_quantity) * COALESCE(m.unit_price, p.price, 0)
    )::numeric AS total,
    SUM(m.quantity - m.reversed_quantity)::bigint AS quantity
  FROM stock_movements m
  JOIN products p ON p.id = m.product_id
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE p_mode = 'purchases'
    AND m.movement_type = 'entry'
    AND m.reverses_movement_id IS NULL
    -- Outillage exclu des totaux
    AND p.product_type = 'consumable'
    AND m.created_at >= make_date(p_year, 1, 1)
    AND m.created_at < make_date(p_year + 1, 1, 1)
    AND (p_organization_id IS NULL OR m.organization_id = p_organization_id)
  GROUP BY 1

  UNION ALL

  SELECT
    COALESCE(c.name, 'Sans catégorie'),
    SUM(p.stock_current * COALESCE(p.price, 0))::numeric,
    SUM(p.stock_current)::bigint
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE p_mode = 'stock'
    AND p.archived_at IS NULL
    AND p.product_type = 'consumable'
    AND p.stock_current > 0
  GROUP BY 1

  ORDER BY 2 DESC;
$$;

COMMENT ON FUNCTION get_purchases_by_category(integer, uuid, text) IS
  'Repartition par categorie, consommables uniquement. L''outillage est exclu des totaux par regle metier.';
