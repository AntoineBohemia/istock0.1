CREATE OR REPLACE FUNCTION get_dashboard_stats(
  p_organization_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH product_stats AS (
    SELECT
      COALESCE(SUM(stock_current), 0) AS total_stock,
      COALESCE(SUM(stock_current * COALESCE(price, 0)), 0) AS total_value,
      COUNT(*) AS total_products,
      COUNT(*) FILTER (
        WHERE COALESCE(stock_current, 0) <= COALESCE(stock_min, 0)
      ) AS low_stock_count
    FROM products
    WHERE (p_organization_id IS NULL OR organization_id = p_organization_id)
      AND archived_at IS NULL
  ),
  movement_stats AS (
    SELECT
      COALESCE(SUM(quantity) FILTER (WHERE movement_type = 'entry'), 0) AS monthly_entries,
      COALESCE(SUM(quantity) FILTER (WHERE movement_type != 'entry'), 0) AS monthly_exits
    FROM stock_movements
    WHERE (p_organization_id IS NULL OR organization_id = p_organization_id)
      AND created_at >= date_trunc('month', CURRENT_DATE)
  ),
  prev_movement_stats AS (
    SELECT
      COALESCE(SUM(quantity) FILTER (WHERE movement_type = 'entry'), 0) AS prev_monthly_entries,
      COALESCE(SUM(quantity) FILTER (WHERE movement_type != 'entry'), 0) AS prev_monthly_exits
    FROM stock_movements
    WHERE (p_organization_id IS NULL OR organization_id = p_organization_id)
      AND created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
      AND created_at < date_trunc('month', CURRENT_DATE)
  ),
  prev_stock AS (
    SELECT
      COALESCE(SUM(stock_current), 0)
        + COALESCE((SELECT SUM(quantity) FILTER (WHERE movement_type != 'entry') FROM stock_movements
            WHERE (p_organization_id IS NULL OR organization_id = p_organization_id)
              AND created_at >= date_trunc('month', CURRENT_DATE)), 0)
        - COALESCE((SELECT SUM(quantity) FILTER (WHERE movement_type = 'entry') FROM stock_movements
            WHERE (p_organization_id IS NULL OR organization_id = p_organization_id)
              AND created_at >= date_trunc('month', CURRENT_DATE)), 0)
      AS prev_month_stock,
      COALESCE(SUM(stock_current * COALESCE(price, 0)), 0) AS current_value
    FROM products
    WHERE (p_organization_id IS NULL OR organization_id = p_organization_id)
      AND archived_at IS NULL
  )
  SELECT jsonb_build_object(
    'totalStock', ps.total_stock,
    'totalValue', ps.total_value,
    'totalProducts', ps.total_products,
    'lowStockCount', ps.low_stock_count,
    'monthlyEntries', ms.monthly_entries,
    'monthlyExits', ms.monthly_exits,
    'prevMonthEntries', pms.prev_monthly_entries,
    'prevMonthExits', pms.prev_monthly_exits,
    'prevMonthStock', pvs.prev_month_stock,
    'prevMonthValue', ROUND(pvs.prev_month_stock::NUMERIC / NULLIF(ps.total_stock, 0) * ps.total_value)
  )
  INTO v_result
  FROM product_stats ps, movement_stats ms, prev_movement_stats pms, prev_stock pvs;

  RETURN v_result;
END;
$$;
