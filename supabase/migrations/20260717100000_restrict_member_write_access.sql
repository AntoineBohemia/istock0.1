-- ============================================================================
-- Restrict member role: block direct INSERT/UPDATE/DELETE on management tables
-- Members can only mutate stock via SECURITY DEFINER RPCs (create_stock_entry, etc.)
-- ============================================================================

-- Helper: true if user is owner or admin in the org
CREATE OR REPLACE FUNCTION public.is_org_admin_or_owner(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
      AND role IN ('owner', 'admin')
  );
$$;

-- products: members cannot create/edit/delete products
CREATE POLICY "member_no_insert_products" ON public.products
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

CREATE POLICY "member_no_update_products" ON public.products
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_org_admin_or_owner(organization_id))
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

CREATE POLICY "member_no_delete_products" ON public.products
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_org_admin_or_owner(organization_id));

-- technicians: members cannot create/edit/delete technicians
CREATE POLICY "member_no_insert_technicians" ON public.technicians
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

CREATE POLICY "member_no_update_technicians" ON public.technicians
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_org_admin_or_owner(organization_id))
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

CREATE POLICY "member_no_delete_technicians" ON public.technicians
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_org_admin_or_owner(organization_id));

-- categories: members cannot create/edit/delete categories
CREATE POLICY "member_no_insert_categories" ON public.categories
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

CREATE POLICY "member_no_update_categories" ON public.categories
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_org_admin_or_owner(organization_id))
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

CREATE POLICY "member_no_delete_categories" ON public.categories
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_org_admin_or_owner(organization_id));

-- suppliers: members cannot create/edit/delete suppliers
CREATE POLICY "member_no_insert_suppliers" ON public.suppliers
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

CREATE POLICY "member_no_update_suppliers" ON public.suppliers
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_org_admin_or_owner(organization_id))
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

CREATE POLICY "member_no_delete_suppliers" ON public.suppliers
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_org_admin_or_owner(organization_id));
