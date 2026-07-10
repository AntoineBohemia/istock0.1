-- =============================================================================
-- RPC : get_dashboard_tasks
-- Retourne un tableau JSONB de tâches actionnables pour le dashboard.
-- Chaque tâche a un type, une priorité, un score de tri, et un résumé FR.
-- =============================================================================
--
-- PLAN DE LA REQUÊTE
-- ──────────────────
--
-- CTE 1 — out_of_stock : produits avec stock_current = 0
--   → priority = critical, score = 1000
--   → Agrégés si count > 3, sinon une tâche par produit
--
-- CTE 2 — below_min : produits 0 < stock_current <= stock_min
--   → priority = important, score = 500 + (stock_min - stock_current), plafonné à 999
--   → Agrégés si count > 3, sinon une tâche par produit
--
-- CTE 3 — never_restocked : TEMPORAIREMENT DÉSACTIVÉ
--   → priority = critical, score = 900
--   → Une tâche par technicien
--
-- CTE 5 — late_restock : TEMPORAIREMENT DÉSACTIVÉ
--   → priority = important, score = 600 + jours_de_retard, plafonné à 999
--   → Une tâche par technicien
--
-- CTE 6 — dormant_products : produits sans mouvement depuis 60 jours
--   → priority = informational, score = 100
--   → Toujours agrégés
--
-- SCORE DE TRI
-- ────────────
-- Chaque tâche reçoit un score entier (0-1000). Les tâches critiques
-- ont les scores les plus élevés (900-1000), les importantes (300-999),
-- les informationnelles (100). Le tri final est ORDER BY score DESC.
-- Les scores dynamiques (below_min, late_restock) augmentent avec la
-- sévérité pour trier au sein d'une même catégorie.
--
-- LOGIQUE D'AGRÉGATION
-- ────────────────────
-- Pour les produits (CTE 1, 2) : si count > 3, une seule tâche agrégée
-- avec entity_ids[] et count. Sinon, une tâche par produit.
-- Pour CTE 3 et 6 : toujours agrégés (rarement urgent au détail).
-- Pour les techniciens (CTE 4, 5) : toujours une tâche par technicien.
--
-- RÉSULTAT FINAL : UNION ALL des 6 CTE → ORDER BY score DESC → LIMIT 20
-- =============================================================================

CREATE OR REPLACE FUNCTION get_dashboard_tasks(
  p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH
  -- =========================================================================
  -- CTE 1 — Produits en rupture de stock (stock_current = 0)
  -- =========================================================================
  out_of_stock AS (
    SELECT
      id,
      name,
      COALESCE(stock_current, 0) AS stock_current
    FROM products
    WHERE organization_id = p_organization_id
      AND archived_at IS NULL
      AND COALESCE(stock_current, 0) = 0
  ),
  out_of_stock_tasks AS (
    -- Si count > 3 : une tâche agrégée
    -- Sinon : une tâche par produit
    SELECT
      'product_out_of_stock'::TEXT AS type,
      'critical'::TEXT AS priority,
      1000 AS score,
      'out_of_stock'::TEXT AS group_key,
      'product'::TEXT AS entity_type,
      ARRAY_AGG(id) AS entity_ids,
      ARRAY_AGG(name) AS entity_names,
      COUNT(*)::INTEGER AS count,
      CASE
        WHEN COUNT(*) > 3 THEN COUNT(*) || ' produits en rupture de stock'
        ELSE NULL  -- sera remplacé par des tâches individuelles
      END AS summary,
      CASE
        WHEN COUNT(*) > 3 THEN '/product?status=alert'
        ELSE NULL
      END AS action_url,
      '{}'::JSONB AS metadata
    FROM out_of_stock
    HAVING COUNT(*) > 3

    UNION ALL

    SELECT
      'product_out_of_stock'::TEXT AS type,
      'critical'::TEXT AS priority,
      1000 AS score,
      'out_of_stock_' || id AS group_key,
      'product'::TEXT AS entity_type,
      ARRAY[id] AS entity_ids,
      ARRAY[name] AS entity_names,
      1 AS count,
      name || ' est en rupture de stock' AS summary,
      '/product/' || id AS action_url,
      '{}'::JSONB AS metadata
    FROM out_of_stock
    WHERE (SELECT COUNT(*) FROM out_of_stock) <= 3
  ),

  -- =========================================================================
  -- CTE 2 — Produits sous le seuil minimum (0 < stock <= stock_min)
  -- =========================================================================
  below_min AS (
    SELECT
      id,
      name,
      COALESCE(stock_current, 0) AS stock_current,
      COALESCE(stock_min, 0) AS stock_min
    FROM products
    WHERE organization_id = p_organization_id
      AND archived_at IS NULL
      AND COALESCE(stock_current, 0) > 0
      AND COALESCE(stock_min, 0) > 0
      AND COALESCE(stock_current, 0) <= COALESCE(stock_min, 0)
  ),
  below_min_tasks AS (
    SELECT
      'product_below_min'::TEXT AS type,
      'important'::TEXT AS priority,
      LEAST(500 + SUM(stock_min - stock_current)::INTEGER / GREATEST(COUNT(*), 1)::INTEGER, 999) AS score,
      'below_min'::TEXT AS group_key,
      'product'::TEXT AS entity_type,
      ARRAY_AGG(id) AS entity_ids,
      ARRAY_AGG(name) AS entity_names,
      COUNT(*)::INTEGER AS count,
      COUNT(*) || ' produits sous le seuil minimum' AS summary,
      '/product?status=alert' AS action_url,
      '{}'::JSONB AS metadata
    FROM below_min
    HAVING COUNT(*) > 3

    UNION ALL

    SELECT
      'product_below_min'::TEXT AS type,
      'important'::TEXT AS priority,
      LEAST(500 + (stock_min - stock_current)::INTEGER, 999) AS score,
      'below_min_' || id AS group_key,
      'product'::TEXT AS entity_type,
      ARRAY[id] AS entity_ids,
      ARRAY[name] AS entity_names,
      1 AS count,
      name || ' : ' || stock_current || '/' || stock_min || ' en stock' AS summary,
      '/product/' || id AS action_url,
      '{}'::JSONB AS metadata
    FROM below_min
    WHERE (SELECT COUNT(*) FROM below_min) <= 3
  ),

  -- =========================================================================
  -- TEMPORAIREMENT DÉSACTIVÉ : CTE 4 & 5 (techniciens restock)
  -- Réactiver quand prêt.
  -- =========================================================================

  -- CTE 4 — Techniciens jamais restockés
  -- never_restocked AS (
  --   SELECT
  --     t.id,
  --     t.first_name,
  --     t.last_name
  --   FROM technicians t
  --   LEFT JOIN technician_inventory_history h
  --     ON h.technician_id = t.id
  --     AND h.organization_id = p_organization_id
  --   WHERE t.organization_id = p_organization_id
  --     AND t.archived_at IS NULL
  --     AND h.id IS NULL
  -- ),
  -- never_restocked_tasks AS (
  --   SELECT
  --     'technician_never_restocked'::TEXT AS type,
  --     'critical'::TEXT AS priority,
  --     900 AS score,
  --     'never_restocked_' || id AS group_key,
  --     'technician'::TEXT AS entity_type,
  --     ARRAY[id] AS entity_ids,
  --     ARRAY[first_name || ' ' || last_name] AS entity_names,
  --     1 AS count,
  --     first_name || ' ' || last_name || ' n''a jamais été restocké' AS summary,
  --     '/users/' || id AS action_url,
  --     '{}'::JSONB AS metadata
  --   FROM never_restocked
  -- ),

  -- CTE 5 — Techniciens avec restock en retard (> 7 jours)
  -- late_restock AS (
  --   SELECT
  --     t.id,
  --     t.first_name,
  --     t.last_name,
  --     EXTRACT(DAY FROM NOW() - MAX(h.created_at))::INTEGER AS days_since_restock
  --   FROM technicians t
  --   INNER JOIN technician_inventory_history h
  --     ON h.technician_id = t.id
  --     AND h.organization_id = p_organization_id
  --   WHERE t.organization_id = p_organization_id
  --     AND t.archived_at IS NULL
  --   GROUP BY t.id, t.first_name, t.last_name
  --   HAVING EXTRACT(DAY FROM NOW() - MAX(h.created_at)) > 7
  -- ),
  -- late_restock_tasks AS (
  --   SELECT
  --     'technician_late_restock'::TEXT AS type,
  --     'important'::TEXT AS priority,
  --     LEAST(600 + days_since_restock, 999) AS score,
  --     'late_restock_' || id AS group_key,
  --     'technician'::TEXT AS entity_type,
  --     ARRAY[id] AS entity_ids,
  --     ARRAY[first_name || ' ' || last_name] AS entity_names,
  --     1 AS count,
  --     first_name || ' ' || last_name || ' : dernier restock il y a ' || days_since_restock || ' jours' AS summary,
  --     '/users/' || id AS action_url,
  --     jsonb_build_object('days_since_restock', days_since_restock) AS metadata
  --   FROM late_restock
  -- ),

  -- =========================================================================
  -- CTE 6 — Produits dormants (aucun mouvement depuis 60 jours)
  -- =========================================================================
  dormant_products AS (
    SELECT
      p.id,
      p.name
    FROM products p
    LEFT JOIN stock_movements sm
      ON sm.product_id = p.id
      AND sm.organization_id = p_organization_id
      AND sm.created_at > NOW() - INTERVAL '60 days'
    WHERE p.organization_id = p_organization_id
      AND p.archived_at IS NULL
      AND sm.id IS NULL
  ),
  dormant_tasks AS (
    SELECT
      'product_dormant'::TEXT AS type,
      'informational'::TEXT AS priority,
      100 AS score,
      'dormant'::TEXT AS group_key,
      'product'::TEXT AS entity_type,
      ARRAY_AGG(id) AS entity_ids,
      ARRAY_AGG(name) AS entity_names,
      COUNT(*)::INTEGER AS count,
      COUNT(*) || ' produits sans mouvement depuis 60 jours' AS summary,
      '/product?status=dormant' AS action_url,
      '{}'::JSONB AS metadata
    FROM dormant_products
    HAVING COUNT(*) > 0
  ),

  -- =========================================================================
  -- UNION ALL + tri par score décroissant
  -- =========================================================================
  all_tasks AS (
    SELECT * FROM out_of_stock_tasks
    UNION ALL
    SELECT * FROM below_min_tasks
    -- TEMPORAIREMENT DÉSACTIVÉ :
    -- UNION ALL
    -- SELECT * FROM never_restocked_tasks
    -- UNION ALL
    -- SELECT * FROM late_restock_tasks
    UNION ALL
    SELECT * FROM dormant_tasks
    ORDER BY score DESC
    LIMIT 20
  )

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'type', type,
        'priority', priority,
        'score', score,
        'group_key', group_key,
        'entity_type', entity_type,
        'entity_ids', entity_ids,
        'entity_names', entity_names,
        'count', count,
        'summary', summary,
        'action_url', action_url,
        'metadata', metadata
      )
    ),
    '[]'::JSONB
  )
  INTO v_result
  FROM all_tasks;

  RETURN v_result;
END;
$$;

-- =============================================================================
-- TEST
-- =============================================================================
-- SELECT get_dashboard_tasks('uuid-org-id-ici');
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
--   1. product_out_of_stock   : stock=0, non-archived                     → -15/product, cap 60
--   2. product_below_min      : 0 < stock ≤ stock_min                     → -4/product,  cap 20
--   3. tech_never_restocked   : TEMPORAIREMENT DÉSACTIVÉ                  → -8/tech,     cap 40
--   4. tech_late_restock      : TEMPORAIREMENT DÉSACTIVÉ                  → -5/tech,     cap 20
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
  -- Les pénalités techniciens sont désactivées le temps de stabiliser
  -- la feature. Réactiver quand prêt.
  -- ══════════════════════════════════════════════════════════════════════

  -- Penalty 3: tech_never_restocked (-8/tech, cap 40)
  -- SELECT COUNT(*) INTO v_count
  -- FROM technicians t
  -- WHERE t.organization_id = p_organization_id
  --   AND t.archived_at IS NULL
  --   AND NOT EXISTS (
  --     SELECT 1 FROM technician_inventory_history h
  --     WHERE h.technician_id = t.id
  --   );
  --
  -- IF v_count > 0 THEN
  --   v_points := LEAST(v_count * 8, 40);
  --   v_score  := v_score - v_points;
  --   v_penalties := v_penalties || jsonb_build_array(jsonb_build_object(
  --     'type',    'tech_never_restocked',
  --     'points',  v_points,
  --     'count',   v_count,
  --     'details', v_count || ' technicien(s) jamais restocké(s)'
  --   ));
  -- END IF;

  -- Penalty 4: tech_late_restock (-5/tech, cap 20)
  -- SELECT COUNT(*) INTO v_count
  -- FROM technicians t
  -- WHERE t.organization_id = p_organization_id
  --   AND t.archived_at IS NULL
  --   AND EXISTS (
  --     SELECT 1 FROM technician_inventory_history h
  --     WHERE h.technician_id = t.id
  --   )
  --   AND (
  --     SELECT MAX(h.created_at)
  --     FROM technician_inventory_history h
  --     WHERE h.technician_id = t.id
  --   ) < NOW() - INTERVAL '7 days';
  --
  -- IF v_count > 0 THEN
  --   v_points := LEAST(v_count * 5, 20);
  --   v_score  := v_score - v_points;
  --   v_penalties := v_penalties || jsonb_build_array(jsonb_build_object(
  --     'type',    'tech_late_restock',
  --     'points',  v_points,
  --     'count',   v_count,
  --     'details', v_count || ' technicien(s) non restocké(s) depuis 7+ jours'
  --   ));
  -- END IF;

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
  INTO v_count, v_points  -- reuse v_points as second counter temporarily
  FROM retro;

  -- Apply prev penalties for stock
  IF v_count > 0 THEN
    v_prev_score := v_prev_score - LEAST(v_count * 15, 60);
  END IF;
  IF v_points > 0 THEN
    v_prev_score := v_prev_score - LEAST(v_points * 4, 20);
  END IF;

  -- TEMPORAIREMENT DÉSACTIVÉ : Penalty 3 & 4 prev (techniciens restock)
  -- Penalty 3 prev: techs never restocked as of prev month end
  -- SELECT COUNT(*) INTO v_count
  -- FROM technicians t
  -- WHERE t.organization_id = p_organization_id
  --   AND t.archived_at IS NULL
  --   AND NOT EXISTS (
  --     SELECT 1 FROM technician_inventory_history h
  --     WHERE h.technician_id = t.id
  --       AND h.created_at < v_month_start
  --   );
  --
  -- IF v_count > 0 THEN
  --   v_prev_score := v_prev_score - LEAST(v_count * 8, 40);
  -- END IF;

  -- Penalty 4 prev: techs with last restock > 7d as of prev month end
  -- SELECT COUNT(*) INTO v_count
  -- FROM technicians t
  -- WHERE t.organization_id = p_organization_id
  --   AND t.archived_at IS NULL
  --   AND EXISTS (
  --     SELECT 1 FROM technician_inventory_history h
  --     WHERE h.technician_id = t.id
  --       AND h.created_at < v_month_start
  --   )
  --   AND (
  --     SELECT MAX(h.created_at)
  --     FROM technician_inventory_history h
  --     WHERE h.technician_id = t.id
  --       AND h.created_at < v_month_start
  --   ) < v_month_start - INTERVAL '7 days';
  --
  -- IF v_count > 0 THEN
  --   v_prev_score := v_prev_score - LEAST(v_count * 5, 20);
  -- END IF;

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
--   3. tech_never_restocked  : TEMPORAIREMENT DÉSACTIVÉ  -8/tech,     cap 40
--   4. tech_late_restock     : TEMPORAIREMENT DÉSACTIVÉ  -5/tech,     cap 20
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
        p.stock_min
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

    -- TEMPORAIREMENT DÉSACTIVÉ : Penalty 3 & 4 (techniciens restock)
    -- Réactiver quand prêt.
    v_tech_never := 0;
    v_tech_late  := 0;

    -- Penalty 3: tech_never_restocked (-8/tech, cap 40)
    -- SELECT COUNT(*) INTO v_tech_never
    -- FROM technicians t
    -- WHERE t.organization_id = p_organization_id
    --   AND t.archived_at IS NULL
    --   AND NOT EXISTS (
    --     SELECT 1 FROM technician_inventory_history h
    --     WHERE h.technician_id = t.id
    --       AND h.created_at < v_month_end
    --   );
    --
    -- IF v_tech_never > 0 THEN
    --   v_penalties_total := v_penalties_total + LEAST(v_tech_never * 8, 40);
    -- END IF;

    -- Penalty 4: tech_late_restock (-5/tech, cap 20)
    -- SELECT COUNT(*) INTO v_tech_late
    -- FROM technicians t
    -- WHERE t.organization_id = p_organization_id
    --   AND t.archived_at IS NULL
    --   AND EXISTS (
    --     SELECT 1 FROM technician_inventory_history h
    --     WHERE h.technician_id = t.id
    --       AND h.created_at < v_month_end
    --   )
    --   AND (
    --     SELECT MAX(h.created_at)
    --     FROM technician_inventory_history h
    --     WHERE h.technician_id = t.id
    --       AND h.created_at < v_month_end
    --   ) < v_month_end - INTERVAL '7 days';
    --
    -- IF v_tech_late > 0 THEN
    --   v_penalties_total := v_penalties_total + LEAST(v_tech_late * 5, 20);
    -- END IF;

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
