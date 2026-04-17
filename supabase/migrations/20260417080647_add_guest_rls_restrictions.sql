-- T2: RLS policies pour le rôle 'guest'
-- Approche : ajouter des policies RESTRICTIVE qui bloquent l'écriture pour guest
-- sans toucher aux policies existantes (SELECT reste autorisé via org_id scope)
-- Les mutations passent par les RPC SECURITY DEFINER (create_stock_entry, create_stock_exit)

-- Helper 1 : true si user courant est membre non-guest de l'org
CREATE OR REPLACE FUNCTION public.is_org_member_non_guest(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
      AND role IN ('owner','admin','member')
  );
$$;

-- Helper 2 : retourne le rôle du user pour une org (utile front via RPC)
CREATE OR REPLACE FUNCTION public.current_user_role_in_org(p_org_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT role FROM user_organizations
  WHERE user_id = auth.uid() AND organization_id = p_org_id
  LIMIT 1;
$$;

-- products
CREATE POLICY "guest_no_insert_products" ON public.products AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.is_org_member_non_guest(organization_id));
CREATE POLICY "guest_no_update_products" ON public.products AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.is_org_member_non_guest(organization_id)) WITH CHECK (public.is_org_member_non_guest(organization_id));
CREATE POLICY "guest_no_delete_products" ON public.products AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_org_member_non_guest(organization_id));

-- technicians
CREATE POLICY "guest_no_insert_technicians" ON public.technicians AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.is_org_member_non_guest(organization_id));
CREATE POLICY "guest_no_update_technicians" ON public.technicians AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.is_org_member_non_guest(organization_id)) WITH CHECK (public.is_org_member_non_guest(organization_id));
CREATE POLICY "guest_no_delete_technicians" ON public.technicians AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_org_member_non_guest(organization_id));

-- stock_movements (guest écrit via RPC SECURITY DEFINER)
CREATE POLICY "guest_no_insert_stock_movements" ON public.stock_movements AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.is_org_member_non_guest(organization_id));
CREATE POLICY "guest_no_update_stock_movements" ON public.stock_movements AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.is_org_member_non_guest(organization_id)) WITH CHECK (public.is_org_member_non_guest(organization_id));
CREATE POLICY "guest_no_delete_stock_movements" ON public.stock_movements AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_org_member_non_guest(organization_id));

-- technician_inventory (guest écrit via RPC)
CREATE POLICY "guest_no_insert_technician_inventory" ON public.technician_inventory AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.is_org_member_non_guest(organization_id));
CREATE POLICY "guest_no_update_technician_inventory" ON public.technician_inventory AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.is_org_member_non_guest(organization_id)) WITH CHECK (public.is_org_member_non_guest(organization_id));
CREATE POLICY "guest_no_delete_technician_inventory" ON public.technician_inventory AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_org_member_non_guest(organization_id));

-- technician_inventory_history
CREATE POLICY "guest_no_insert_technician_inventory_history" ON public.technician_inventory_history AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.is_org_member_non_guest(organization_id));
CREATE POLICY "guest_no_update_technician_inventory_history" ON public.technician_inventory_history AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.is_org_member_non_guest(organization_id)) WITH CHECK (public.is_org_member_non_guest(organization_id));
CREATE POLICY "guest_no_delete_technician_inventory_history" ON public.technician_inventory_history AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_org_member_non_guest(organization_id));

-- categories
CREATE POLICY "guest_no_insert_categories" ON public.categories AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.is_org_member_non_guest(organization_id));
CREATE POLICY "guest_no_update_categories" ON public.categories AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.is_org_member_non_guest(organization_id)) WITH CHECK (public.is_org_member_non_guest(organization_id));
CREATE POLICY "guest_no_delete_categories" ON public.categories AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_org_member_non_guest(organization_id));

-- suppliers
CREATE POLICY "guest_no_insert_suppliers" ON public.suppliers AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.is_org_member_non_guest(organization_id));
CREATE POLICY "guest_no_update_suppliers" ON public.suppliers AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.is_org_member_non_guest(organization_id)) WITH CHECK (public.is_org_member_non_guest(organization_id));
CREATE POLICY "guest_no_delete_suppliers" ON public.suppliers AS RESTRICTIVE FOR DELETE TO authenticated USING (public.is_org_member_non_guest(organization_id));
