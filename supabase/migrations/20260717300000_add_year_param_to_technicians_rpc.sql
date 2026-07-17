-- Add p_year parameter to get_technicians_with_stats so the frontend can query any year
CREATE OR REPLACE FUNCTION get_technicians_with_stats(
  p_organization_id UUID DEFAULT NULL,
  p_year INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_year_start TIMESTAMPTZ;
  v_year_end TIMESTAMPTZ;
BEGIN
  -- Default to current year if not provided
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
      'vehicle_plate', t.vehicle_plate,
      'vehicle_brand', t.vehicle_brand,
      'photo_url', t.photo_url,
      'organization_name', o.name,
      'tablet_ref', t.tablet_ref,
      'clothing_size', t.clothing_size,
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
    FROM technician_inventory
    GROUP BY technician_id
  ) inv ON inv.technician_id = t.id
  LEFT JOIN (
    SELECT technician_id, SUM(quantity) AS year_total
    FROM stock_movements
    WHERE movement_type = 'exit_technician'
      AND created_at >= v_year_start
      AND created_at < v_year_end
    GROUP BY technician_id
  ) ymv ON ymv.technician_id = t.id
  LEFT JOIN (
    SELECT DISTINCT ON (technician_id)
      technician_id,
      created_at AS last_restock
    FROM technician_inventory_history
    ORDER BY technician_id, created_at DESC
  ) hist ON hist.technician_id = t.id
  LEFT JOIN (
    SELECT technician_id, SUM(quantity) AS eq_count
    FROM equipment_assignments
    GROUP BY technician_id
  ) eq ON eq.technician_id = t.id
  WHERE (p_organization_id IS NULL OR t.organization_id = p_organization_id)
    AND t.archived_at IS NULL;

  RETURN v_result;
END;
$$;
