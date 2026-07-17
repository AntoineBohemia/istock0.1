-- ============================================================================
-- Remove guest role entirely
-- Simplify to 3 roles: owner, admin, member
-- ============================================================================

-- 1. Update CHECK constraints to remove 'guest'
ALTER TABLE public.user_organizations DROP CONSTRAINT IF EXISTS user_organizations_role_check;
ALTER TABLE public.user_organizations
  ADD CONSTRAINT user_organizations_role_check
  CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text]));

ALTER TABLE public.organization_invitations DROP CONSTRAINT IF EXISTS organization_invitations_role_check;
ALTER TABLE public.organization_invitations
  ADD CONSTRAINT organization_invitations_role_check
  CHECK (role = ANY (ARRAY['admin'::text, 'member'::text]));

-- 2. Drop all guest RESTRICTIVE RLS policies
DROP POLICY IF EXISTS "guest_no_insert_products" ON public.products;
DROP POLICY IF EXISTS "guest_no_update_products" ON public.products;
DROP POLICY IF EXISTS "guest_no_delete_products" ON public.products;

DROP POLICY IF EXISTS "guest_no_insert_technicians" ON public.technicians;
DROP POLICY IF EXISTS "guest_no_update_technicians" ON public.technicians;
DROP POLICY IF EXISTS "guest_no_delete_technicians" ON public.technicians;

DROP POLICY IF EXISTS "guest_no_insert_stock_movements" ON public.stock_movements;
DROP POLICY IF EXISTS "guest_no_update_stock_movements" ON public.stock_movements;
DROP POLICY IF EXISTS "guest_no_delete_stock_movements" ON public.stock_movements;

DROP POLICY IF EXISTS "guest_no_insert_technician_inventory" ON public.technician_inventory;
DROP POLICY IF EXISTS "guest_no_update_technician_inventory" ON public.technician_inventory;
DROP POLICY IF EXISTS "guest_no_delete_technician_inventory" ON public.technician_inventory;

DROP POLICY IF EXISTS "guest_no_insert_technician_inventory_history" ON public.technician_inventory_history;
DROP POLICY IF EXISTS "guest_no_update_technician_inventory_history" ON public.technician_inventory_history;
DROP POLICY IF EXISTS "guest_no_delete_technician_inventory_history" ON public.technician_inventory_history;

DROP POLICY IF EXISTS "guest_no_insert_categories" ON public.categories;
DROP POLICY IF EXISTS "guest_no_update_categories" ON public.categories;
DROP POLICY IF EXISTS "guest_no_delete_categories" ON public.categories;

DROP POLICY IF EXISTS "guest_no_insert_suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "guest_no_update_suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "guest_no_delete_suppliers" ON public.suppliers;

DROP POLICY IF EXISTS "guest_no_insert_pos" ON public.product_organization_stock;
DROP POLICY IF EXISTS "guest_no_update_pos" ON public.product_organization_stock;
DROP POLICY IF EXISTS "guest_no_delete_pos" ON public.product_organization_stock;

-- 3. Drop helper functions that were only used for guest checks
DROP FUNCTION IF EXISTS public.is_org_member_non_guest(uuid);
DROP FUNCTION IF EXISTS public.current_user_role_in_org(uuid);
