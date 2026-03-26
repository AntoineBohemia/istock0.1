-- Fix: la policy SELECT sur organization_invitations était "true" (public)
-- Tout utilisateur pouvait lire toutes les invitations et tokens
-- Remplacement par deux policies restrictives

DROP POLICY IF EXISTS "View invitations" ON public.organization_invitations;

-- Policy 1 : Les admins/owners voient les invitations de leur org
CREATE POLICY "Admins can view org invitations"
  ON public.organization_invitations
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT uo.organization_id
      FROM user_organizations uo
      WHERE uo.user_id = auth.uid()
        AND uo.role IN ('owner', 'admin')
    )
  );

-- Policy 2 : Un utilisateur peut voir les invitations qui lui sont destinées (par email)
CREATE POLICY "Users can view own invitations by email"
  ON public.organization_invitations
  FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower(auth.jwt() ->> 'email')
  );
