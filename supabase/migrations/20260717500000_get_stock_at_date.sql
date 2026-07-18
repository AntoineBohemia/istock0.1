-- ============================================================================
-- RPC: get_stock_at_date
-- Reconstructs stock quantities at a specific date by replaying movements.
-- Returns all non-archived consumable products with their computed stock,
-- current stock, and the price valid at the target date.
-- ============================================================================

-- Performance index for the aggregation
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_created_at
ON stock_movements (product_id, created_at);

CREATE OR REPLACE FUNCTION get_stock_at_date(
  p_organization_id UUID,
  p_target_date TIMESTAMPTZ,
  p_filter_org_id UUID DEFAULT NULL
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  product_sku TEXT,
  category_name TEXT,
  supplier_name TEXT,
  stock_at_date BIGINT,
  stock_current INT,
  stock_min INT,
  price_at_date NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT
    p.id AS product_id,
    p.name AS product_name,
    p.sku AS product_sku,
    c.name AS category_name,
    s.name AS supplier_name,
    COALESCE(
      SUM(
        CASE
          WHEN sm.movement_type IN ('entry', 'unassign_equipment') THEN sm.quantity
          ELSE -sm.quantity
        END
      ),
      0
    )::BIGINT AS stock_at_date,
    COALESCE(p.stock_current, 0) AS stock_current,
    COALESCE(p.stock_min, 0) AS stock_min,
    COALESCE(
      (
        SELECT ph.price
        FROM product_price_history ph
        WHERE ph.product_id = p.id
          AND ph.effective_from <= p_target_date
        ORDER BY ph.effective_from DESC
        LIMIT 1
      ),
      p.price
    ) AS price_at_date
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN suppliers s ON s.id = p.supplier_id
  LEFT JOIN stock_movements sm
    ON sm.product_id = p.id
    AND sm.created_at <= p_target_date
    AND (p_filter_org_id IS NULL OR sm.organization_id = p_filter_org_id)
  WHERE p.organization_id = p_organization_id
    AND p.archived_at IS NULL
    AND p.product_type = 'consumable'
  GROUP BY p.id, p.name, p.sku, c.name, s.name, p.stock_current, p.stock_min, p.price
  ORDER BY p.name ASC;
END;
$$;
