-- ============================================================================
-- Phase 3: Update read RPCs to include per-org stock breakdown
-- Additive changes — existing fields unchanged, new stock_by_org field added
-- ============================================================================

-- 1. get_health_score — add stock_by_org to KPI
CREATE OR REPLACE FUNCTION get_health_score(
  p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_score        INTEGER := 100;
  v_penalties    JSONB   := '[]'::JSONB;
  v_count        INTEGER;
  v_points       INTEGER;
  v_label        TEXT;
  v_color        TEXT;

  v_total_stock       BIGINT;
  v_total_value       NUMERIC;
  v_entries_month     BIGINT;
  v_exits_month       BIGINT;
  v_entries_prev      BIGINT;
  v_exits_prev        BIGINT;
  v_stock_by_org      JSONB;

  v_prev_score        INTEGER := 100;

  v_month_start       TIMESTAMPTZ := date_trunc('month', CURRENT_DATE);
  v_prev_month_start  TIMESTAMPTZ := date_trunc('month', CURRENT_DATE - INTERVAL '1 month');

  v_entries_30d       NUMERIC;
  v_exits_30d         NUMERIC;
  v_has_recent_entry  BOOLEAN;

  v_prev_entries_30d  NUMERIC;
  v_prev_exits_30d    NUMERIC;
  v_prev_has_entry    BOOLEAN;

  v_direction         TEXT;
BEGIN
  -- ══════════════════════════════════════════════════════════════════════
  -- KPIs
  -- ══════════════════════════════════════════════════════════════════════

  -- Current stock & value (global, from products table)
  SELECT
    COALESCE(SUM(stock_current), 0),
    COALESCE(SUM(stock_current * COALESCE(price, 0)), 0)
  INTO v_total_stock, v_total_value
  FROM products
  WHERE organization_id = p_organization_id
    AND archived_at IS NULL;

  -- Per-org stock breakdown (from product_organization_stock)
  SELECT COALESCE(jsonb_agg(row_data ORDER BY row_data->>'org_name'), '[]'::JSONB)
  INTO v_stock_by_org
  FROM (
    SELECT jsonb_build_object(
      'org_id', pos.organization_id,
      'org_name', o.name,
      'stock', SUM(pos.stock_current),
      'value', SUM(pos.stock_current * COALESCE(p.price, 0))
    ) AS row_data
    FROM product_organization_stock pos
    JOIN products p ON p.id = pos.product_id
    JOIN organizations o ON o.id = pos.organization_id
    WHERE p.organization_id = p_organization_id
      AND p.archived_at IS NULL
    GROUP BY pos.organization_id, o.name
  ) sub;

  -- This-month entries & exits
  SELECT
    COALESCE(SUM(quantity) FILTER (WHERE movement_type = 'entry'), 0),
    COALESCE(SUM(quantity) FILTER (WHERE movement_type != 'entry'), 0)
  INTO v_entries_month, v_exits_month
  FROM stock_movements
  WHERE organization_id = p_organization_id
    AND created_at >= v_month_start;

  -- Previous-month entries & exits
  SELECT
    COALESCE(SUM(quantity) FILTER (WHERE movement_type = 'entry'), 0),
    COALESCE(SUM(quantity) FILTER (WHERE movement_type != 'entry'), 0)
  INTO v_entries_prev, v_exits_prev
  FROM stock_movements
  WHERE organization_id = p_organization_id
    AND created_at >= v_prev_month_start
    AND created_at <  v_month_start;

  -- ══════════════════════════════════════════════════════════════════════
  -- CURRENT SCORE — Penalty 1: product_out_of_stock (-15/product, cap 60)
  -- ══════════════════════════════════════════════════════════════════════
  SELECT COUNT(*) INTO v_count
  FROM products
  WHERE organization_id = p_organization_id
    AND archived_at IS NULL
    AND COALESCE(stock_current, 0) = 0;

  IF v_count > 0 THEN
    v_points := LEAST(v_count * 15, 60);
    v_score  := v_score - v_points;
    v_penalties := v_penalties || jsonb_build_array(jsonb_build_object(
      'type',    'product_out_of_stock',
      'points',  v_points,
      'count',   v_count,
      'details', v_count || ' produit(s) en rupture de stock'
    ));
  END IF;

  -- ══════════════════════════════════════════════════════════════════════
  -- Penalty 2: product_below_min (-4/product, cap 20)
  -- ══════════════════════════════════════════════════════════════════════
  SELECT COUNT(*) INTO v_count
  FROM products
  WHERE organization_id = p_organization_id
    AND archived_at IS NULL
    AND stock_current > 0
    AND stock_min > 0
    AND stock_current <= stock_min;

  IF v_count > 0 THEN
    v_points := LEAST(v_count * 4, 20);
    v_score  := v_score - v_points;
    v_penalties := v_penalties || jsonb_build_array(jsonb_build_object(
      'type',    'product_below_min',
      'points',  v_points,
      'count',   v_count,
      'details', v_count || ' produit(s) sous le seuil minimum'
    ));
  END IF;

  -- ══════════════════════════════════════════════════════════════════════
  -- TEMPORAIREMENT DÉSACTIVÉ : Penalty 3 & 4 (techniciens restock)
  -- ══════════════════════════════════════════════════════════════════════

  -- ══════════════════════════════════════════════════════════════════════
  -- Penalty 5: exits_exceed_entries — exits_30d > entries_30d × 1.3 (-10)
  -- ══════════════════════════════════════════════════════════════════════
  SELECT
    COALESCE(SUM(quantity) FILTER (WHERE movement_type = 'entry'), 0),
    COALESCE(SUM(quantity) FILTER (WHERE movement_type != 'entry'), 0)
  INTO v_entries_30d, v_exits_30d
  FROM stock_movements
  WHERE organization_id = p_organization_id
    AND created_at >= NOW() - INTERVAL '30 days';

  IF v_entries_30d > 0 AND v_exits_30d > v_entries_30d * 1.3 THEN
    v_score := v_score - 10;
    v_penalties := v_penalties || jsonb_build_array(jsonb_build_object(
      'type',    'exits_exceed_entries',
      'points',  10,
      'count',   1,
      'details', 'Les sorties dépassent les entrées de +30% sur 30 jours'
    ));
  END IF;

  -- ══════════════════════════════════════════════════════════════════════
  -- Penalty 6: no_recent_entries — 0 entries in 14 days (-5)
  -- ══════════════════════════════════════════════════════════════════════
  SELECT EXISTS (
    SELECT 1 FROM stock_movements
    WHERE organization_id = p_organization_id
      AND movement_type = 'entry'
      AND created_at >= NOW() - INTERVAL '14 days'
  ) INTO v_has_recent_entry;

  IF NOT v_has_recent_entry THEN
    v_score := v_score - 5;
    v_penalties := v_penalties || jsonb_build_array(jsonb_build_object(
      'type',    'no_recent_entries',
      'points',  5,
      'count',   1,
      'details', 'Aucune entrée de stock depuis 14 jours'
    ));
  END IF;

  v_score := GREATEST(0, v_score);

  -- ══════════════════════════════════════════════════════════════════════
  -- Label + colour
  -- ══════════════════════════════════════════════════════════════════════
  IF v_score >= 90 THEN
    v_label := 'Sous contrôle';            v_color := 'green';
  ELSIF v_score >= 70 THEN
    v_label := 'Quelques points d''attention'; v_color := 'green';
  ELSIF v_score >= 40 THEN
    v_label := 'Situation dégradée';       v_color := 'orange';
  ELSE
    v_label := 'Action urgente requise';   v_color := 'red';
  END IF;

  -- ══════════════════════════════════════════════════════════════════════
  -- PREVIOUS-MONTH SCORE
  -- ══════════════════════════════════════════════════════════════════════
  WITH retro AS (
    SELECT
      p.id,
      COALESCE(p.stock_current, 0)
        + COALESCE(sm_exits.qty, 0)
        - COALESCE(sm_entries.qty, 0) AS prev_stock,
      p.stock_min
    FROM products p
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(quantity), 0) AS qty
      FROM stock_movements
      WHERE product_id = p.id
        AND movement_type = 'entry'
        AND created_at >= v_month_start
    ) sm_entries ON TRUE
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(quantity), 0) AS qty
      FROM stock_movements
      WHERE product_id = p.id
        AND movement_type != 'entry'
        AND created_at >= v_month_start
    ) sm_exits ON TRUE
    WHERE p.organization_id = p_organization_id
      AND p.archived_at IS NULL
  )
  SELECT
    COUNT(*) FILTER (WHERE prev_stock <= 0),
    COUNT(*) FILTER (WHERE prev_stock > 0 AND stock_min > 0 AND prev_stock <= stock_min)
  INTO v_count, v_points
  FROM retro;

  IF v_count > 0 THEN
    v_prev_score := v_prev_score - LEAST(v_count * 15, 60);
  END IF;
  IF v_points > 0 THEN
    v_prev_score := v_prev_score - LEAST(v_points * 4, 20);
  END IF;

  SELECT
    COALESCE(SUM(quantity) FILTER (WHERE movement_type = 'entry'), 0),
    COALESCE(SUM(quantity) FILTER (WHERE movement_type != 'entry'), 0)
  INTO v_prev_entries_30d, v_prev_exits_30d
  FROM stock_movements
  WHERE organization_id = p_organization_id
    AND created_at >= v_month_start - INTERVAL '30 days'
    AND created_at <  v_month_start;

  IF v_prev_entries_30d > 0 AND v_prev_exits_30d > v_prev_entries_30d * 1.3 THEN
    v_prev_score := v_prev_score - 10;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM stock_movements
    WHERE organization_id = p_organization_id
      AND movement_type = 'entry'
      AND created_at >= v_month_start - INTERVAL '14 days'
      AND created_at <  v_month_start
  ) INTO v_prev_has_entry;

  IF NOT v_prev_has_entry THEN
    v_prev_score := v_prev_score - 5;
  END IF;

  v_prev_score := GREATEST(0, v_prev_score);

  IF v_score > v_prev_score THEN
    v_direction := 'up';
  ELSIF v_score < v_prev_score THEN
    v_direction := 'down';
  ELSE
    v_direction := 'stable';
  END IF;

  -- ══════════════════════════════════════════════════════════════════════
  -- Assemble final JSONB
  -- ══════════════════════════════════════════════════════════════════════
  RETURN jsonb_build_object(
    'score',     v_score,
    'label',     v_label,
    'color',     v_color,
    'penalties', v_penalties,
    'trend',     jsonb_build_object(
      'previous_score', v_prev_score,
      'direction',      v_direction
    ),
    'kpi',       jsonb_build_object(
      'total_stock',       v_total_stock,
      'total_value',       v_total_value,
      'stock_by_org',      v_stock_by_org,
      'entries_month',     v_entries_month,
      'exits_month',       v_exits_month,
      'entries_prev_month', v_entries_prev,
      'exits_prev_month',  v_exits_prev
    )
  );
END;
$$;


-- 2. get_dashboard_stats — add stockByOrg breakdown
CREATE OR REPLACE FUNCTION get_dashboard_stats(
  p_organization_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_stock_by_org JSONB;
BEGIN
  -- Per-org stock breakdown
  SELECT COALESCE(jsonb_agg(row_data ORDER BY row_data->>'org_name'), '[]'::JSONB)
  INTO v_stock_by_org
  FROM (
    SELECT jsonb_build_object(
      'org_id', pos.organization_id,
      'org_name', o.name,
      'stock', SUM(pos.stock_current),
      'value', SUM(pos.stock_current * COALESCE(p.price, 0))
    ) AS row_data
    FROM product_organization_stock pos
    JOIN products p ON p.id = pos.product_id
    JOIN organizations o ON o.id = pos.organization_id
    WHERE (p_organization_id IS NULL OR p.organization_id = p_organization_id)
      AND p.archived_at IS NULL
    GROUP BY pos.organization_id, o.name
  ) sub;

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
    'stockByOrg', v_stock_by_org,
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
