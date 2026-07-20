-- ============================================================
-- Table: vehicles
-- ============================================================

CREATE TABLE public.vehicles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Identite
  name            TEXT NOT NULL,
  license_plate   TEXT NOT NULL,
  brand           TEXT,
  model           TEXT,
  year            SMALLINT,
  vin             TEXT,

  -- Technique
  fuel_type       TEXT CHECK (fuel_type IN ('diesel','essence','electrique','hybride')),
  mileage         INTEGER DEFAULT 0,

  -- Assignation (optionnel)
  technician_id   UUID REFERENCES public.technicians(id) ON DELETE SET NULL,

  -- Meta
  notes           TEXT,
  archived_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX idx_vehicles_organization ON public.vehicles(organization_id);
CREATE INDEX idx_vehicles_technician   ON public.vehicles(technician_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Org-scoped PERMISSIVE policies
CREATE POLICY "org_select_vehicles" ON public.vehicles
  FOR SELECT
  USING (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "org_insert_vehicles" ON public.vehicles
  FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "org_update_vehicles" ON public.vehicles
  FOR UPDATE
  USING (organization_id IN (SELECT public.get_user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "org_delete_vehicles" ON public.vehicles
  FOR DELETE
  USING (organization_id IN (SELECT public.get_user_organization_ids()));

-- RESTRICTIVE: block members from write operations
CREATE POLICY "member_no_insert_vehicles" ON public.vehicles
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

CREATE POLICY "member_no_update_vehicles" ON public.vehicles
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_org_admin_or_owner(organization_id))
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

CREATE POLICY "member_no_delete_vehicles" ON public.vehicles
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_org_admin_or_owner(organization_id));
