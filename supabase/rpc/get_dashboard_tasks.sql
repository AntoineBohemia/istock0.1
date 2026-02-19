-- =============================================================================
-- RPC : get_dashboard_tasks
-- Retourne un tableau JSONB de tâches actionnables pour le dashboard.
-- Chaque tâche a un type, une priorité, un score de tri, et un résumé FR.
-- =============================================================================
--
-- PLAN DE LA REQUÊTE
-- ──────────────────
--
-- CTE 1 — out_of_stock : produits avec stock_current = 0 (track_stock = true)
--   → priority = critical, score = 1000
--   → Agrégés si count > 3, sinon une tâche par produit
--
-- CTE 2 — below_min : produits 0 < stock_current <= stock_min
--   → priority = important, score = 500 + (stock_min - stock_current), plafonné à 999
--   → Agrégés si count > 3, sinon une tâche par produit
--
-- CTE 3 — overstocked : produits stock_current >= 2 * stock_max
--   → priority = important, score = 300
--   → Toujours agrégés
--
-- CTE 4 — never_restocked : techniciens sans aucun historique de restock
--   → priority = critical, score = 900
--   → Une tâche par technicien
--
-- CTE 5 — late_restock : techniciens dont le dernier restock > 7 jours
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
      AND COALESCE(track_stock, true) = true
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
      AND COALESCE(track_stock, true) = true
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
  -- CTE 3 — Produits en surstockage (stock >= 2 * stock_max)
  -- =========================================================================
  overstocked AS (
    SELECT
      id,
      name,
      COALESCE(stock_current, 0) AS stock_current,
      COALESCE(stock_max, 0) AS stock_max
    FROM products
    WHERE organization_id = p_organization_id
      AND COALESCE(track_stock, true) = true
      AND archived_at IS NULL
      AND COALESCE(stock_max, 0) > 0
      AND COALESCE(stock_current, 0) >= 2 * COALESCE(stock_max, 0)
  ),
  overstocked_tasks AS (
    SELECT
      'product_overstocked'::TEXT AS type,
      'important'::TEXT AS priority,
      300 AS score,
      'overstocked'::TEXT AS group_key,
      'product'::TEXT AS entity_type,
      ARRAY_AGG(id) AS entity_ids,
      ARRAY_AGG(name) AS entity_names,
      COUNT(*)::INTEGER AS count,
      COUNT(*) || ' produits en surstockage critique' AS summary,
      '/product?status=alert' AS action_url,
      '{}'::JSONB AS metadata
    FROM overstocked
    HAVING COUNT(*) > 0
  ),

  -- =========================================================================
  -- CTE 4 — Techniciens jamais restockés
  -- =========================================================================
  never_restocked AS (
    SELECT
      t.id,
      t.first_name,
      t.last_name
    FROM technicians t
    LEFT JOIN technician_inventory_history h
      ON h.technician_id = t.id
      AND h.organization_id = p_organization_id
    WHERE t.organization_id = p_organization_id
      AND t.archived_at IS NULL
      AND h.id IS NULL
  ),
  never_restocked_tasks AS (
    SELECT
      'technician_never_restocked'::TEXT AS type,
      'critical'::TEXT AS priority,
      900 AS score,
      'never_restocked_' || id AS group_key,
      'technician'::TEXT AS entity_type,
      ARRAY[id] AS entity_ids,
      ARRAY[first_name || ' ' || last_name] AS entity_names,
      1 AS count,
      first_name || ' ' || last_name || ' n''a jamais été restocké' AS summary,
      '/users/' || id AS action_url,
      '{}'::JSONB AS metadata
    FROM never_restocked
  ),

  -- =========================================================================
  -- CTE 5 — Techniciens avec restock en retard (> 7 jours)
  -- =========================================================================
  late_restock AS (
    SELECT
      t.id,
      t.first_name,
      t.last_name,
      EXTRACT(DAY FROM NOW() - MAX(h.created_at))::INTEGER AS days_since_restock
    FROM technicians t
    INNER JOIN technician_inventory_history h
      ON h.technician_id = t.id
      AND h.organization_id = p_organization_id
    WHERE t.organization_id = p_organization_id
      AND t.archived_at IS NULL
    GROUP BY t.id, t.first_name, t.last_name
    HAVING EXTRACT(DAY FROM NOW() - MAX(h.created_at)) > 7
  ),
  late_restock_tasks AS (
    SELECT
      'technician_late_restock'::TEXT AS type,
      'important'::TEXT AS priority,
      LEAST(600 + days_since_restock, 999) AS score,
      'late_restock_' || id AS group_key,
      'technician'::TEXT AS entity_type,
      ARRAY[id] AS entity_ids,
      ARRAY[first_name || ' ' || last_name] AS entity_names,
      1 AS count,
      first_name || ' ' || last_name || ' : dernier restock il y a ' || days_since_restock || ' jours' AS summary,
      '/users/' || id AS action_url,
      jsonb_build_object('days_since_restock', days_since_restock) AS metadata
    FROM late_restock
  ),

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
      AND COALESCE(p.track_stock, true) = true
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
    UNION ALL
    SELECT * FROM overstocked_tasks
    UNION ALL
    SELECT * FROM never_restocked_tasks
    UNION ALL
    SELECT * FROM late_restock_tasks
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
