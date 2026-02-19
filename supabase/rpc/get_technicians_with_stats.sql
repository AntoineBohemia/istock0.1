CREATE OR REPLACE FUNCTION get_technicians_with_stats(
  p_organization_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'first_name', t.first_name,
      'last_name', t.last_name,
      'email', t.email,
      'phone', t.phone,
      'city', t.city,
      'organization_id', t.organization_id,
      'created_at', t.created_at,
      'inventory', '[]'::JSONB,
      'inventory_count', COALESCE(inv.total_quantity, 0),
      'last_restock_at', hist.last_restock
    ) ORDER BY t.last_name ASC
  ), '[]'::JSONB)
  INTO v_result
  FROM technicians t
  LEFT JOIN (
    SELECT technician_id, SUM(quantity) AS total_quantity
    FROM technician_inventory
    GROUP BY technician_id
  ) inv ON inv.technician_id = t.id
  LEFT JOIN (
    SELECT DISTINCT ON (technician_id)
      technician_id,
      created_at AS last_restock
    FROM technician_inventory_history
    ORDER BY technician_id, created_at DESC
  ) hist ON hist.technician_id = t.id
  WHERE (p_organization_id IS NULL OR t.organization_id = p_organization_id)
    AND t.archived_at IS NULL;

  RETURN v_result;
END;
$$;
