-- Repartition des achats et de la valeur de stock par categorie.
--
-- Les cartes de la page Achats donnent un total sans dire de quoi il est fait.
-- Cette fonction fournit le detail derriere chaque carte : par societe, en
-- cumul, ou sur la valeur de stock.
--
-- p_organization_id NULL = toutes societes (cas du cumul).
-- p_mode 'purchases' = achats de l'annee, 'stock' = valeur de stock actuelle.
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
      -- Quantite nette : ce qui a ete corrige n'a pas ete achete.
      (m.quantity - m.reversed_quantity)
      -- Prix paye, pas le tarif du jour : sinon une revision tarifaire
      -- reecrit les achats passes.
      * COALESCE(m.unit_price, p.price, 0)
    )::numeric AS total,
    SUM(m.quantity - m.reversed_quantity)::bigint AS quantity
  FROM stock_movements m
  JOIN products p ON p.id = m.product_id
  LEFT JOIN categories c ON c.id = p.category_id
  WHERE p_mode = 'purchases'
    AND m.movement_type = 'entry'
    AND m.reverses_movement_id IS NULL
    AND m.created_at >= make_date(p_year, 1, 1)
    AND m.created_at < make_date(p_year + 1, 1, 1)
    AND (p_organization_id IS NULL OR m.organization_id = p_organization_id)
  GROUP BY 1

  UNION ALL

  -- Valeur de stock : consommables uniquement, comme l'export « etat de stock ».
  -- L'outillage n'entre pas dans ce perimetre.
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
  'Repartition par categorie des achats d''une annee (mode purchases) ou de la valeur de stock (mode stock).';
