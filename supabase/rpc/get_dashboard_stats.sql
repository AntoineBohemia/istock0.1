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
        WHERE stock_max > 0 AND stock_min >= 0 AND stock_current >= 0
          AND (
            -- score < 30: stock <= min OR (overstock >= 2*max) OR
            -- (stock between min and max with low ratio) OR (overstock moderate with low score)
            stock_current <= stock_min
            OR stock_current >= stock_max * 2
            OR (stock_current > stock_min AND stock_current <= stock_max
                AND (stock_max - stock_min) > 0
                AND ROUND(((stock_current - stock_min)::NUMERIC / (stock_max - stock_min)) * 100) < 30)
            OR (stock_current > stock_max AND stock_current < stock_max * 2
                AND ROUND(GREATEST(0, 100 - ((stock_current - stock_max)::NUMERIC / stock_max) * 100)) < 30)
          )
      ) AS low_stock_count
    FROM products
    WHERE (p_organization_id IS NULL OR organization_id = p_organization_id)
  ),
  movement_stats AS (
    SELECT
      COALESCE(SUM(quantity) FILTER (WHERE movement_type = 'entry'), 0) AS monthly_entries,
      COALESCE(SUM(quantity) FILTER (WHERE movement_type != 'entry'), 0) AS monthly_exits
    FROM stock_movements
    WHERE (p_organization_id IS NULL OR organization_id = p_organization_id)
      AND created_at >= date_trunc('month', CURRENT_DATE)
  )
  SELECT jsonb_build_object(
    'totalStock', ps.total_stock,
    'totalValue', ps.total_value,
    'totalProducts', ps.total_products,
    'lowStockCount', ps.low_stock_count,
    'monthlyEntries', ms.monthly_entries,
    'monthlyExits', ms.monthly_exits
  )
  INTO v_result
  FROM product_stats ps, movement_stats ms;

  RETURN v_result;
END;
$$;
