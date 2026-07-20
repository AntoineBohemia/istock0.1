-- Statistiques d'achat par fournisseur.
--
-- La page Fournisseurs n'affichait qu'un annuaire (nom, e-mail, nb de produits)
-- alors que stock_movements.supplier_id et purchase_invoices.supplier_id sont
-- alimentes depuis le debut. Cette fonction expose ce qui existe deja :
-- combien on depense chez qui, quand on a commande pour la derniere fois,
-- et combien de produits sont en alerte chez ce fournisseur.
--
-- DROP explicite : un CREATE OR REPLACE avec une signature differente cree une
-- SECONDE surcharge au lieu de remplacer, et les appels deviennent ambigus.
DROP FUNCTION IF EXISTS get_suppliers_with_stats(uuid);

CREATE FUNCTION get_suppliers_with_stats(p_organization_id uuid)
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
  -- Sous-requetes separees : un LEFT JOIN direct sur trois tables multiplierait
  -- les lignes entre elles et fausserait les totaux.
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
      supplier_id,
      SUM(quantity * COALESCE(unit_price, 0)) AS total_purchased,
      MAX(created_at) AS last_purchase_at
    FROM stock_movements
    WHERE movement_type = 'entry'
    GROUP BY supplier_id
  ) m ON m.supplier_id = s.id
  LEFT JOIN (
    SELECT supplier_id, COUNT(*) AS invoice_count
    FROM purchase_invoices
    GROUP BY supplier_id
  ) i ON i.supplier_id = s.id
  WHERE s.organization_id = p_organization_id
  ORDER BY s.name ASC;
$$;

COMMENT ON FUNCTION get_suppliers_with_stats(uuid) IS
  'Fournisseurs d''une organisation, avec depense totale, dernier achat, produits en alerte et nombre de factures.';
