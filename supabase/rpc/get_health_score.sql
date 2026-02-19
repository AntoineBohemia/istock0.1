-- ============================================================================
-- get_health_score(p_organization_id UUID) → JSONB
-- ============================================================================
-- Single RPC powering the dashboard header: score + penalties + trend + KPIs.
--
-- Return shape:
-- {
--   score        : 0-100,
--   label        : "Sous contrôle" | "Quelques points d'attention" | "Situation dégradée" | "Action urgente requise",
--   color        : "green" | "orange" | "red",
--   penalties    : [{ type, points, count, details }],
--   trend        : { previous_score: int|null, direction: "up"|"down"|"stable" },
--   kpi          : { total_stock, total_value, entries_month, exits_month, entries_prev_month, exits_prev_month }
-- }
--
-- Penalty rules (budget = 100):
--   1. product_out_of_stock   : stock=0, track_stock, non-archived        → -15/product, cap 60
--   2. product_below_min      : 0 < stock ≤ stock_min                     → -4/product,  cap 20
--   3. tech_never_restocked   : no history row, non-archived              → -8/tech,     cap 40
--   4. tech_late_restock      : last restock > 7 days ago                 → -5/tech,     cap 20
--   5. exits_exceed_entries   : exits_30d > entries_30d × 1.3             → -10 fixed
--   6. no_recent_entries      : 0 entries in last 14 days                 → -5 fixed
--
-- Previous-month score: penalties re-evaluated with retro-calculated stocks
-- (same method as getGlobalStockEvolution: stock_end_prev = stock_now + exits_this_month - entries_this_month).
-- ============================================================================

CREATE OR REPLACE FUNCTION get_health_score(
  p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- Current score
  v_score        INTEGER := 100;
  v_penalties    JSONB   := '[]'::JSONB;
  v_count        INTEGER;
  v_points       INTEGER;
  v_label        TEXT;
  v_color        TEXT;

  -- KPI accumulators
  v_total_stock       BIGINT;
  v_total_value       NUMERIC;
  v_entries_month     BIGINT;
  v_exits_month       BIGINT;
  v_entries_prev      BIGINT;
  v_exits_prev        BIGINT;

  -- Previous-month score
  v_prev_score        INTEGER := 100;
  v_prev_stock_arr    RECORD;

  -- Shared dates
  v_month_start       TIMESTAMPTZ := date_trunc('month', CURRENT_DATE);
  v_prev_month_start  TIMESTAMPTZ := date_trunc('month', CURRENT_DATE - INTERVAL '1 month');

  -- Movement helpers
  v_entries_30d       NUMERIC;
  v_exits_30d         NUMERIC;
  v_has_recent_entry  BOOLEAN;

  -- Prev-month movement helpers
  v_prev_entries_30d  NUMERIC;
  v_prev_exits_30d    NUMERIC;
  v_prev_has_entry    BOOLEAN;

  -- Trend
  v_direction         TEXT;
BEGIN
  -- ══════════════════════════════════════════════════════════════════════
  -- KPIs  (replaces separate get_dashboard_stats call)
  -- ══════════════════════════════════════════════════════════════════════

  -- Current stock & value (non-archived products only)
  SELECT
    COALESCE(SUM(stock_current), 0),
    COALESCE(SUM(stock_current * COALESCE(price, 0)), 0)
  INTO v_total_stock, v_total_value
  FROM products
  WHERE organization_id = p_organization_id
    AND archived_at IS NULL;

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
    AND track_stock = TRUE
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
    AND track_stock = TRUE
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
  -- Penalty 3: tech_never_restocked (-8/tech, cap 40)
  -- ══════════════════════════════════════════════════════════════════════
  SELECT COUNT(*) INTO v_count
  FROM technicians t
  WHERE t.organization_id = p_organization_id
    AND t.archived_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM technician_inventory_history h
      WHERE h.technician_id = t.id
    );

  IF v_count > 0 THEN
    v_points := LEAST(v_count * 8, 40);
    v_score  := v_score - v_points;
    v_penalties := v_penalties || jsonb_build_array(jsonb_build_object(
      'type',    'tech_never_restocked',
      'points',  v_points,
      'count',   v_count,
      'details', v_count || ' technicien(s) jamais restocké(s)'
    ));
  END IF;

  -- ══════════════════════════════════════════════════════════════════════
  -- Penalty 4: tech_late_restock (-5/tech, cap 20)
  -- ══════════════════════════════════════════════════════════════════════
  SELECT COUNT(*) INTO v_count
  FROM technicians t
  WHERE t.organization_id = p_organization_id
    AND t.archived_at IS NULL
    AND EXISTS (
      SELECT 1 FROM technician_inventory_history h
      WHERE h.technician_id = t.id
    )
    AND (
      SELECT MAX(h.created_at)
      FROM technician_inventory_history h
      WHERE h.technician_id = t.id
    ) < NOW() - INTERVAL '7 days';

  IF v_count > 0 THEN
    v_points := LEAST(v_count * 5, 20);
    v_score  := v_score - v_points;
    v_penalties := v_penalties || jsonb_build_array(jsonb_build_object(
      'type',    'tech_late_restock',
      'points',  v_points,
      'count',   v_count,
      'details', v_count || ' technicien(s) non restocké(s) depuis 7+ jours'
    ));
  END IF;

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

  -- Clamp
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
  -- PREVIOUS-MONTH SCORE  (retro-calculated, same penalty logic)
  -- Retro-stock: stock_prev_month_end = stock_current + exits_this_month - entries_this_month
  -- (per-product, so we can check out-of-stock / below-min accurately)
  -- ══════════════════════════════════════════════════════════════════════

  -- Penalty 1 prev: out of stock last month end
  WITH retro AS (
    SELECT
      p.id,
      COALESCE(p.stock_current, 0)
        + COALESCE(sm_exits.qty, 0)
        - COALESCE(sm_entries.qty, 0) AS prev_stock,
      p.stock_min,
      p.track_stock
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
      AND p.track_stock = TRUE
  )
  SELECT
    COUNT(*) FILTER (WHERE prev_stock <= 0),
    COUNT(*) FILTER (WHERE prev_stock > 0 AND stock_min > 0 AND prev_stock <= stock_min)
  INTO v_count, v_points  -- reuse v_points as second counter temporarily
  FROM retro;

  -- Apply prev penalties for stock
  IF v_count > 0 THEN
    v_prev_score := v_prev_score - LEAST(v_count * 15, 60);
  END IF;
  IF v_points > 0 THEN
    v_prev_score := v_prev_score - LEAST(v_points * 4, 20);
  END IF;

  -- Penalty 3 prev: techs never restocked as of prev month end
  SELECT COUNT(*) INTO v_count
  FROM technicians t
  WHERE t.organization_id = p_organization_id
    AND t.archived_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM technician_inventory_history h
      WHERE h.technician_id = t.id
        AND h.created_at < v_month_start
    );

  IF v_count > 0 THEN
    v_prev_score := v_prev_score - LEAST(v_count * 8, 40);
  END IF;

  -- Penalty 4 prev: techs with last restock > 7d as of prev month end
  SELECT COUNT(*) INTO v_count
  FROM technicians t
  WHERE t.organization_id = p_organization_id
    AND t.archived_at IS NULL
    AND EXISTS (
      SELECT 1 FROM technician_inventory_history h
      WHERE h.technician_id = t.id
        AND h.created_at < v_month_start
    )
    AND (
      SELECT MAX(h.created_at)
      FROM technician_inventory_history h
      WHERE h.technician_id = t.id
        AND h.created_at < v_month_start
    ) < v_month_start - INTERVAL '7 days';

  IF v_count > 0 THEN
    v_prev_score := v_prev_score - LEAST(v_count * 5, 20);
  END IF;

  -- Penalty 5 prev: exits > entries 30d window ending at prev month end
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

  -- Penalty 6 prev: no entries in 14d window ending at prev month end
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

  -- Trend direction
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
      'entries_month',     v_entries_month,
      'exits_month',       v_exits_month,
      'entries_prev_month', v_entries_prev,
      'exits_prev_month',  v_exits_prev
    )
  );
END;
$$;
