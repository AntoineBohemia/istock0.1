-- Les fournisseurs se lisent en cumul, pas par societe courante.
--
-- Tous les administrateurs sont membres de SMPR ET SEIREN et doivent voir
-- exactement les memes fournisseurs. La fonction filtrait sur une seule societe
-- (celle du selecteur, un reglage local a chaque navigateur) : un compte regle
-- sur SEIREN — qui n'a aucun fournisseur en propre — voyait une liste vide, un
-- autre regle sur SMPR en voyait cinq. Deux comptes, deux affichages.
--
-- p_organization_id devient optionnel : NULL rend l'ensemble des fournisseurs
-- visibles par l'utilisateur. La fonction est SECURITY INVOKER, le RLS borne
-- donc deja la lecture aux societes du compte — le cumul est celui de SMPR +
-- SEIREN, identique pour tout le monde. L'argument reste accepte pour ne pas
-- casser un appel qui ciblerait encore une societe precise.

DROP FUNCTION IF EXISTS get_suppliers_with_stats(uuid);

CREATE FUNCTION get_suppliers_with_stats(p_organization_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  phone text,
  website_url text,
  organization_id uuid,
  created_at timestamptz,
  product_count bigint,
  alert_count bigint,
  total_purchased numeric,
  last_purchase_at timestamptz,
  invoice_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.name,
    s.email,
    s.phone,
    s.website_url,
    s.organization_id,
    s.created_at,
    COALESCE(p.product_count, 0),
    COALESCE(p.alert_count, 0),
    COALESCE(m.total_purchased, 0),
    m.last_purchase_at,
    COALESCE(i.invoice_count, 0)
  FROM suppliers s
  LEFT JOIN (
    SELECT
      supplier_id,
      COUNT(*) AS product_count,
      COUNT(*) FILTER (
        WHERE stock_current <= stock_min
      ) AS alert_count
    FROM products
    WHERE archived_at IS NULL
    GROUP BY supplier_id
  ) p ON p.supplier_id = s.id
  LEFT JOIN (
    SELECT
      mv.supplier_id,
      SUM((mv.quantity - mv.reversed_quantity) * COALESCE(mv.unit_price, 0)) AS total_purchased,
      MAX(mv.created_at) AS last_purchase_at
    FROM stock_movements mv
    JOIN products pr ON pr.id = mv.product_id
    WHERE mv.movement_type = 'entry'
      AND mv.reverses_movement_id IS NULL
      AND pr.archived_at IS NULL
      AND pr.product_type = 'consumable'
    GROUP BY mv.supplier_id
  ) m ON m.supplier_id = s.id
  LEFT JOIN (
    SELECT supplier_id, COUNT(*) AS invoice_count
    FROM purchase_invoices
    GROUP BY supplier_id
  ) i ON i.supplier_id = s.id
  -- NULL = cumul (le RLS scope aux societes de l'utilisateur) ; sinon une
  -- societe precise, pour un appel qui le demanderait encore.
  WHERE (p_organization_id IS NULL OR s.organization_id = p_organization_id)
  ORDER BY s.name ASC;
$$;

COMMENT ON FUNCTION get_suppliers_with_stats(uuid) IS
  'Fournisseurs visibles par l''utilisateur (cumul SMPR + SEIREN si p_organization_id est NULL). Depense = consommables actifs, corrections deduites.';
