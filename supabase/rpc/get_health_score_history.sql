-- ============================================================================
-- get_health_score_history(p_organization_id UUID, p_months INTEGER) → JSONB
-- ============================================================================
-- Returns the health score for each of the last p_months months.
-- Used to render the score evolution chart on the dashboard.
--
-- Return shape (JSONB array):
-- [
--   {
--     "month"                 : "2025-09",
--     "score"                 : 0-100,
--     "penalties_total"       : integer,
--     "product_zero_count"    : integer,
--     "product_low_count"     : integer,
--     "technician_never_count": integer,
--     "technician_late_count" : integer
--   },
--   ...
-- ]
--
-- Methodology:
-- For each month M (from oldest to newest):
--   1. Reconstitute per-product stock at end of month M using:
--      stock_at_end_M = stock_current - entries_after_M + exits_after_M
--   2. Count products at stock=0 and below stock_min at that date
--   3. Evaluate technician restock state as of end of month M
--   4. Evaluate entries/exits within month M for flow-based penalties
--   5. Apply the same penalty grid as get_health_score → score for month M
--
-- Penalty grid (same as get_health_score):
--   1. product_out_of_stock  : -15/product, cap 60
--   2. product_below_min     : -4/product,  cap 20
--   3. tech_never_restocked  : -8/tech,     cap 40
--   4. tech_late_restock     : -5/tech,     cap 20
--   5. exits_exceed_entries  : -10 fixed (exits_30d > entries_30d × 1.3)
--   6. no_recent_entries     : -5 fixed  (0 entries in 14 days before month end)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_health_score_history(
  p_organization_id UUID,
  p_months          INTEGER DEFAULT 6
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result          JSONB := '[]'::JSONB;
  v_month_cursor    TIMESTAMPTZ;
  v_month_end       TIMESTAMPTZ;
  v_month_key       TEXT;
  v_score           INTEGER;
  v_penalties_total  INTEGER;

  -- Per-month penalty counters
  v_product_zero    INTEGER;
  v_product_low     INTEGER;
  v_tech_never      INTEGER;
  v_tech_late       INTEGER;

  -- Movement helpers for flow-based penalties
  v_entries_30d     NUMERIC;
  v_exits_30d       NUMERIC;
  v_has_entry_14d   BOOLEAN;

  -- Loop variable
  v_i               INTEGER;
BEGIN
  -- ══════════════════════════════════════════════════════════════════════════
  -- Loop from oldest month to newest (p_months ago → last complete month).
  -- We skip the current (incomplete) month: the live score covers that.
  -- ══════════════════════════════════════════════════════════════════════════
  FOR v_i IN REVERSE p_months..1 LOOP
    -- v_month_cursor = start of month M
    -- v_month_end    = start of the month AFTER M  (exclusive upper bound)
    v_month_cursor := date_trunc('month', CURRENT_DATE - (v_i || ' months')::INTERVAL);
    v_month_end    := v_month_cursor + INTERVAL '1 month';
    v_month_key    := to_char(v_month_cursor, 'YYYY-MM');

    -- Reset score for this month
    v_score          := 100;
    v_penalties_total := 0;
    v_product_zero   := 0;
    v_product_low    := 0;
    v_tech_never     := 0;
    v_tech_late      := 0;

    -- ════════════════════════════════════════════════════════════════════════
    -- STEP 1+2: Reconstitute per-product stock at end of month M
    --
    -- Formula: stock_at_end_M = stock_current
    --            - SUM(entries AFTER month M)   ← undo future entries
    --            + SUM(exits AFTER month M)     ← undo future exits
    --
    -- Then count products with reconstituted stock = 0 and below stock_min.
    -- ════════════════════════════════════════════════════════════════════════
    WITH retro_stock AS (
      SELECT
        p.id,
        -- Reconstituted stock at end of month M
        COALESCE(p.stock_current, 0)
          - COALESCE(future_entries.qty, 0)
          + COALESCE(future_exits.qty, 0) AS stock_at_month_end,
        p.stock_min,
        p.track_stock
      FROM products p
      -- Sum of all entries AFTER month M (to undo)
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(quantity), 0) AS qty
        FROM stock_movements
        WHERE product_id = p.id
          AND movement_type = 'entry'
          AND created_at >= v_month_end
      ) future_entries ON TRUE
      -- Sum of all exits AFTER month M (to undo)
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(quantity), 0) AS qty
        FROM stock_movements
        WHERE product_id = p.id
          AND movement_type != 'entry'
          AND created_at >= v_month_end
      ) future_exits ON TRUE
      WHERE p.organization_id = p_organization_id
        AND p.archived_at IS NULL
        AND p.track_stock = TRUE
    )
    SELECT
      COUNT(*) FILTER (WHERE stock_at_month_end <= 0),
      COUNT(*) FILTER (WHERE stock_at_month_end > 0
                         AND stock_min > 0
                         AND stock_at_month_end <= stock_min)
    INTO v_product_zero, v_product_low
    FROM retro_stock;

    -- Penalty 1: product_out_of_stock (-15/product, cap 60)
    IF v_product_zero > 0 THEN
      v_penalties_total := v_penalties_total + LEAST(v_product_zero * 15, 60);
    END IF;

    -- Penalty 2: product_below_min (-4/product, cap 20)
    IF v_product_low > 0 THEN
      v_penalties_total := v_penalties_total + LEAST(v_product_low * 4, 20);
    END IF;

    -- ════════════════════════════════════════════════════════════════════════
    -- STEP 3: Technician restock state as of end of month M
    --
    -- "Never restocked" = no history row with created_at < v_month_end
    -- "Late restock"    = has history but last restock before v_month_end
    --                     is older than 7 days before v_month_end
    -- ════════════════════════════════════════════════════════════════════════

    -- Penalty 3: tech_never_restocked (-8/tech, cap 40)
    SELECT COUNT(*) INTO v_tech_never
    FROM technicians t
    WHERE t.organization_id = p_organization_id
      AND t.archived_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM technician_inventory_history h
        WHERE h.technician_id = t.id
          AND h.created_at < v_month_end
      );

    IF v_tech_never > 0 THEN
      v_penalties_total := v_penalties_total + LEAST(v_tech_never * 8, 40);
    END IF;

    -- Penalty 4: tech_late_restock (-5/tech, cap 20)
    -- Techs who HAVE been restocked before v_month_end, but whose
    -- most recent restock before v_month_end is > 7 days old.
    SELECT COUNT(*) INTO v_tech_late
    FROM technicians t
    WHERE t.organization_id = p_organization_id
      AND t.archived_at IS NULL
      AND EXISTS (
        SELECT 1 FROM technician_inventory_history h
        WHERE h.technician_id = t.id
          AND h.created_at < v_month_end
      )
      AND (
        SELECT MAX(h.created_at)
        FROM technician_inventory_history h
        WHERE h.technician_id = t.id
          AND h.created_at < v_month_end
      ) < v_month_end - INTERVAL '7 days';

    IF v_tech_late > 0 THEN
      v_penalties_total := v_penalties_total + LEAST(v_tech_late * 5, 20);
    END IF;

    -- ════════════════════════════════════════════════════════════════════════
    -- STEP 4: Flow-based penalties using movements within month M
    -- ════════════════════════════════════════════════════════════════════════

    -- Penalty 5: exits_exceed_entries (-10 fixed)
    -- Use the 30-day window ending at month end.
    -- Since months are ~30 days, this is essentially the month's movements.
    SELECT
      COALESCE(SUM(quantity) FILTER (WHERE movement_type = 'entry'), 0),
      COALESCE(SUM(quantity) FILTER (WHERE movement_type != 'entry'), 0)
    INTO v_entries_30d, v_exits_30d
    FROM stock_movements
    WHERE organization_id = p_organization_id
      AND created_at >= v_month_end - INTERVAL '30 days'
      AND created_at <  v_month_end;

    IF v_entries_30d > 0 AND v_exits_30d > v_entries_30d * 1.3 THEN
      v_penalties_total := v_penalties_total + 10;
    END IF;

    -- Penalty 6: no_recent_entries (-5 fixed)
    -- Check for any entry in the 14 days before month end.
    SELECT EXISTS (
      SELECT 1 FROM stock_movements
      WHERE organization_id = p_organization_id
        AND movement_type = 'entry'
        AND created_at >= v_month_end - INTERVAL '14 days'
        AND created_at <  v_month_end
    ) INTO v_has_entry_14d;

    IF NOT v_has_entry_14d THEN
      v_penalties_total := v_penalties_total + 5;
    END IF;

    -- ════════════════════════════════════════════════════════════════════════
    -- STEP 5: Compute final score for month M
    -- ════════════════════════════════════════════════════════════════════════
    v_score := GREATEST(0, 100 - v_penalties_total);

    -- Append this month's result to the JSONB array
    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'month',                  v_month_key,
      'score',                  v_score,
      'penalties_total',        v_penalties_total,
      'product_zero_count',     v_product_zero,
      'product_low_count',      v_product_low,
      'technician_never_count', v_tech_never,
      'technician_late_count',  v_tech_late
    ));
  END LOOP;

  RETURN v_result;
END;
$$;
