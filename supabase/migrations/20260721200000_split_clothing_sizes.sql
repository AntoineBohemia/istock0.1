-- Taille de vetement : separer le haut et le bas.
--
-- Une seule colonne clothing_size ne peut pas porter deux systemes de mesure :
-- le haut se note en lettres (S, M, L...) et le bas en pointures francaises
-- (36, 38, 40...).
--
-- Les 2 valeurs existantes sont des « M », donc des tailles de haut : un
-- simple renommage conserve leur sens, aucune reprise de donnees necessaire.
ALTER TABLE technicians RENAME COLUMN clothing_size TO clothing_size_top;
ALTER TABLE technicians ADD COLUMN IF NOT EXISTS clothing_size_bottom text;

COMMENT ON COLUMN technicians.clothing_size_top IS 'Taille du haut : XS a 3XL.';
COMMENT ON COLUMN technicians.clothing_size_bottom IS 'Taille du bas : pointure francaise (36, 38, 40...).';

-- get_technicians_with_stats lit clothing_size : sans cette mise a jour, la
-- fonction leverait « column t.clothing_size does not exist » et la page
-- Techniciens cesserait de s'afficher — exactement ce qui s'est produit lors
-- du retrait des colonnes vehicle_*.
--
-- Signature inchangee (uuid, integer) : CREATE OR REPLACE remplace donc la
-- fonction au lieu d'en creer une seconde surcharge.
CREATE OR REPLACE FUNCTION public.get_technicians_with_stats(
  p_organization_id uuid DEFAULT NULL::uuid,
  p_year integer DEFAULT NULL::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_result JSONB;
  v_year_start TIMESTAMPTZ;
  v_year_end TIMESTAMPTZ;
BEGIN
  v_year_start := make_date(COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::INT), 1, 1)::TIMESTAMPTZ;
  v_year_end := v_year_start + INTERVAL '1 year';

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'first_name', t.first_name,
      'last_name', t.last_name,
      'email', t.email,
      'phone', t.phone,
      'city', t.city,
      'photo_url', t.photo_url,
      'organization_name', o.name,
      'tablet_ref', t.tablet_ref,
      'clothing_size_top', t.clothing_size_top,
      'clothing_size_bottom', t.clothing_size_bottom,
      'organization_id', t.organization_id,
      'created_at', t.created_at,
      'inventory', '[]'::JSONB,
      'inventory_count', COALESCE(inv.total_quantity, 0),
      'year_units_total', COALESCE(ymv.year_total, 0),
      'last_restock_at', hist.last_restock,
      'equipment_count', COALESCE(eq.eq_count, 0)
    ) ORDER BY t.last_name ASC
  ), '[]'::JSONB)
  INTO v_result
  FROM technicians t
  LEFT JOIN organizations o ON o.id = t.organization_id
  LEFT JOIN (
    SELECT technician_id, SUM(quantity) AS total_quantity
    FROM technician_inventory GROUP BY technician_id
  ) inv ON inv.technician_id = t.id
  LEFT JOIN (
    SELECT technician_id, SUM(quantity) AS year_total
    FROM stock_movements
    WHERE movement_type = 'exit_technician'
      AND created_at >= v_year_start AND created_at < v_year_end
    GROUP BY technician_id
  ) ymv ON ymv.technician_id = t.id
  LEFT JOIN (
    SELECT DISTINCT ON (technician_id) technician_id, created_at AS last_restock
    FROM technician_inventory_history
    ORDER BY technician_id, created_at DESC
  ) hist ON hist.technician_id = t.id
  LEFT JOIN (
    SELECT technician_id, SUM(quantity) AS eq_count
    FROM equipment_assignments GROUP BY technician_id
  ) eq ON eq.technician_id = t.id
  WHERE (p_organization_id IS NULL OR t.organization_id = p_organization_id)
    AND t.archived_at IS NULL;

  RETURN v_result;
END;
$function$;
