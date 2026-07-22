-- La depense par fournisseur ne comptait pas le meme perimetre que ses produits.
--
-- Sur une meme ligne de la page Fournisseurs, « produits » excluait les fiches
-- archivees tandis que « total depense » les incluait : BARBOT affichait quatre
-- produits et 1 605 EUR provenant de deux fiches devenues invisibles. Impossible
-- de rapprocher les deux chiffres, et impossible de deviner pourquoi.
--
-- La sous-requete des mouvements ne joignait tout simplement pas products : ni
-- archived_at ni product_type n'etaient a sa portee. Elle emportait donc aussi
-- l'outillage, alors que la regle metier le tient hors des totaux d'achats
-- depuis la migration 20260722200000 — 3 417,50 EUR comptes a tort.
--
-- Troisieme correctif au passage : une entree annulee restait comptee. La
-- correction inverse existe en base, la depense ne la voyait pas.
--
-- product_count et alert_count ne changent pas : un outil reste un produit du
-- fournisseur, il n'est exclu que des sommes d'argent.

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
      mv.supplier_id,
      -- Net des corrections : une entree de dix unites dont six ont ete
      -- annulees a coute quatre unites, pas dix.
      SUM((mv.quantity - mv.reversed_quantity) * COALESCE(mv.unit_price, 0)) AS total_purchased,
      MAX(mv.created_at) AS last_purchase_at
    FROM stock_movements mv
    JOIN products pr ON pr.id = mv.product_id
    WHERE mv.movement_type = 'entry'
      -- Une ligne de correction n'est pas un achat : elle en defait un.
      AND mv.reverses_movement_id IS NULL
      -- Meme perimetre que le nombre de produits affiche a cote.
      AND pr.archived_at IS NULL
      -- Regle metier : l'outillage est un investissement, pas une depense
      -- d'achat. Il ne figure dans aucun total.
      AND pr.product_type = 'consumable'
    GROUP BY mv.supplier_id
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
  'Fournisseurs d''une organisation. La depense totale ne compte que les consommables actifs, corrections deduites ; le nombre de produits couvre tout le catalogue actif du fournisseur.';
