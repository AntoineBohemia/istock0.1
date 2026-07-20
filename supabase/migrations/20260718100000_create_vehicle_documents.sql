-- ============================================================
-- Table: vehicle_documents
-- Stores metadata for files attached to vehicles.
-- document_type discriminates between the 3 tabs:
--   'contract', 'revision', 'insurance'
-- ============================================================

CREATE TABLE public.vehicle_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id      UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Discriminant (maps to UI tab)
  document_type   TEXT NOT NULL CHECK (document_type IN ('contract','revision','insurance')),

  -- File metadata
  label           TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_url        TEXT NOT NULL,
  file_size       INTEGER,
  mime_type       TEXT,

  -- Validity dates (optional)
  valid_from      DATE,
  valid_until     DATE,

  -- Meta
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index
CREATE INDEX idx_vdocs_vehicle      ON public.vehicle_documents(vehicle_id);
CREATE INDEX idx_vdocs_vehicle_type ON public.vehicle_documents(vehicle_id, document_type);
CREATE INDEX idx_vdocs_organization ON public.vehicle_documents(organization_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;

-- Org-scoped PERMISSIVE policies
CREATE POLICY "org_select_vdocs" ON public.vehicle_documents
  FOR SELECT
  USING (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "org_insert_vdocs" ON public.vehicle_documents
  FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "org_update_vdocs" ON public.vehicle_documents
  FOR UPDATE
  USING (organization_id IN (SELECT public.get_user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "org_delete_vdocs" ON public.vehicle_documents
  FOR DELETE
  USING (organization_id IN (SELECT public.get_user_organization_ids()));

-- RESTRICTIVE: block members from write operations
CREATE POLICY "member_no_insert_vdocs" ON public.vehicle_documents
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

CREATE POLICY "member_no_update_vdocs" ON public.vehicle_documents
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_org_admin_or_owner(organization_id))
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

CREATE POLICY "member_no_delete_vdocs" ON public.vehicle_documents
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_org_admin_or_owner(organization_id));
