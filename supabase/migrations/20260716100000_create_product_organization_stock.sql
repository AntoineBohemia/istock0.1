-- ============================================================================
-- Phase 1: Per-organization stock tracking
-- Creates product_organization_stock junction table and initializes data
-- from existing stock_movements + products.stock_current
-- ============================================================================

-- 1. Create the table
CREATE TABLE product_organization_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stock_current INTEGER NOT NULL DEFAULT 0 CHECK (stock_current >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, organization_id)
);

-- 2. Index for fast lookups (per-product breakdown, per-org filtering)
CREATE INDEX idx_pos_product_id ON product_organization_stock(product_id);
CREATE INDEX idx_pos_organization_id ON product_organization_stock(organization_id);
CREATE INDEX idx_pos_product_org ON product_organization_stock(product_id, organization_id);

-- 3. RLS — same pattern as other org-scoped tables
ALTER TABLE product_organization_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_select" ON product_organization_stock
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT get_user_organization_ids()));

CREATE POLICY "pos_insert" ON product_organization_stock
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT get_user_organization_ids()));

CREATE POLICY "pos_update" ON product_organization_stock
  FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT get_user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT get_user_organization_ids()));

CREATE POLICY "pos_delete" ON product_organization_stock
  FOR DELETE TO authenticated
  USING (organization_id IN (SELECT get_user_organization_ids()));

-- Guest restrictions (RESTRICTIVE, same pattern as other tables)
CREATE POLICY "guest_no_insert_pos" ON product_organization_stock
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member_non_guest(organization_id));

CREATE POLICY "guest_no_update_pos" ON product_organization_stock
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_org_member_non_guest(organization_id))
  WITH CHECK (public.is_org_member_non_guest(organization_id));

CREATE POLICY "guest_no_delete_pos" ON product_organization_stock
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_org_member_non_guest(organization_id));

-- 4. Initialize from existing movements
-- Step A: Insert per-org stock derived from movements (positive values only)
INSERT INTO product_organization_stock (product_id, organization_id, stock_current)
SELECT
  sm.product_id,
  sm.organization_id,
  GREATEST(0,
    SUM(CASE WHEN sm.movement_type = 'entry' THEN sm.quantity ELSE 0 END)
    - SUM(CASE WHEN sm.movement_type IN ('exit_technician','exit_anonymous','exit_loss','assign_equipment') THEN sm.quantity ELSE 0 END)
  ) AS derived_stock
FROM stock_movements sm
JOIN products p ON p.id = sm.product_id
WHERE sm.organization_id IS NOT NULL
  AND p.archived_at IS NULL
GROUP BY sm.product_id, sm.organization_id
HAVING GREATEST(0,
  SUM(CASE WHEN sm.movement_type = 'entry' THEN sm.quantity ELSE 0 END)
  - SUM(CASE WHEN sm.movement_type IN ('exit_technician','exit_anonymous','exit_loss','assign_equipment') THEN sm.quantity ELSE 0 END)
) > 0;

-- Step B: Reconcile with products.stock_current
-- If stock_current > SUM(derived), the remainder is untracked initial stock
-- → assign it to the product's own organization_id
WITH current_pos_totals AS (
  SELECT product_id, SUM(stock_current) AS pos_total
  FROM product_organization_stock
  GROUP BY product_id
)
INSERT INTO product_organization_stock (product_id, organization_id, stock_current)
SELECT
  p.id,
  p.organization_id,
  p.stock_current - COALESCE(ct.pos_total, 0)
FROM products p
LEFT JOIN current_pos_totals ct ON ct.product_id = p.id
WHERE p.archived_at IS NULL
  AND p.stock_current > COALESCE(ct.pos_total, 0)
ON CONFLICT (product_id, organization_id)
DO UPDATE SET
  stock_current = product_organization_stock.stock_current + EXCLUDED.stock_current,
  updated_at = NOW();

-- Step C: Handle products with stock_current = 0 that have no rows yet
-- Insert a zero-stock row for the product's own org so the product appears in per-org queries
INSERT INTO product_organization_stock (product_id, organization_id, stock_current)
SELECT p.id, p.organization_id, 0
FROM products p
WHERE p.archived_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM product_organization_stock pos WHERE pos.product_id = p.id)
ON CONFLICT (product_id, organization_id) DO NOTHING;

-- Step D: Cap overflows — some products had stock manually adjusted below
-- what movements indicate. For single-org products, cap pos to match stock_current.
UPDATE product_organization_stock pos
SET stock_current = p.stock_current, updated_at = NOW()
FROM products p
WHERE pos.product_id = p.id
  AND p.archived_at IS NULL
  AND pos.stock_current > p.stock_current
  AND (SELECT COUNT(*) FROM product_organization_stock pos2 WHERE pos2.product_id = p.id) = 1;
