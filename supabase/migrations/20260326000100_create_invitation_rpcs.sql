-- RPC sécurisés pour le flux d'invitation
-- Remplacent les opérations client-side directes sur organization_invitations

-- RPC 1 : Consulter une invitation par token
CREATE OR REPLACE FUNCTION get_invitation_details(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_masked_email TEXT;
BEGIN
  SELECT
    i.id, i.email, i.role, i.expires_at, i.accepted_at, i.created_at,
    o.name AS organization_name, o.logo_url AS organization_logo_url
  INTO v_invitation
  FROM organization_invitations i
  JOIN organizations o ON o.id = i.organization_id
  WHERE i.token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  IF v_invitation.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'already_accepted');
  END IF;

  IF v_invitation.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;

  v_masked_email := substring(v_invitation.email from 1 for 1)
    || '***'
    || substring(v_invitation.email from position('@' in v_invitation.email) - 1 for 1)
    || substring(v_invitation.email from position('@' in v_invitation.email));

  RETURN jsonb_build_object(
    'valid', true,
    'email', v_invitation.email,
    'masked_email', v_masked_email,
    'role', v_invitation.role,
    'expires_at', v_invitation.expires_at,
    'organization_name', v_invitation.organization_name,
    'organization_logo_url', v_invitation.organization_logo_url
  );
END;
$$;

-- RPC 2 : Accepter une invitation (atomique, avec verrouillage)
CREATE OR REPLACE FUNCTION accept_invitation_secure(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_invitation RECORD;
  v_org RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  SELECT * INTO v_invitation
  FROM organization_invitations
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invitation_not_found');
  END IF;

  IF v_invitation.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_accepted');
  END IF;

  IF v_invitation.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;

  IF lower(v_invitation.email) <> lower(v_user_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'email_mismatch',
      'expected_email', v_invitation.email);
  END IF;

  IF EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = v_user_id AND organization_id = v_invitation.organization_id
  ) THEN
    UPDATE organization_invitations SET accepted_at = now() WHERE id = v_invitation.id;
    RETURN jsonb_build_object('success', false, 'error', 'already_member');
  END IF;

  INSERT INTO user_organizations (user_id, organization_id, role, is_default)
  VALUES (v_user_id, v_invitation.organization_id, v_invitation.role, false);

  UPDATE organization_invitations SET accepted_at = now() WHERE id = v_invitation.id;

  SELECT id, name, slug, logo_url INTO v_org
  FROM organizations WHERE id = v_invitation.organization_id;

  RETURN jsonb_build_object(
    'success', true,
    'organization', jsonb_build_object(
      'id', v_org.id, 'name', v_org.name,
      'slug', v_org.slug, 'logo_url', v_org.logo_url
    ),
    'role', v_invitation.role
  );
END;
$$;
