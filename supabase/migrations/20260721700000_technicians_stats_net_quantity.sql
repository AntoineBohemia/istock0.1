-- get_technicians_with_stats : sorties de l'annee nettes des corrections.
--
-- La fonction sommait toutes les sorties 'exit_technician', y compris celles
-- qui ont ete corrigees depuis. Un technicien dont on annule une sortie de 3
-- voyait toujours ces 3 unites comptees dans son total annuel.
--
-- Signature inchangee : CREATE OR REPLACE remplace bien la fonction.
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
    -- Quantite nette : on ecarte les lignes de correction et on retranche
    -- de chaque sortie la part qui a ete corrigee.
    SELECT technician_id, SUM(quantity - reversed_quantity) AS year_total
    FROM stock_movements
    WHERE movement_type = 'exit_technician'
      AND reverses_movement_id IS NULL
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
