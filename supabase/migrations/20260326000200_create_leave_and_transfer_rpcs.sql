-- RPC : Quitter une organisation
CREATE OR REPLACE FUNCTION leave_organization(p_organization_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_member_count INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  SELECT role INTO v_role
  FROM user_organizations
  WHERE user_id = v_user_id AND organization_id = p_organization_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_member');
  END IF;

  IF v_role = 'owner' THEN
    SELECT count(*) INTO v_member_count
    FROM user_organizations
    WHERE organization_id = p_organization_id AND user_id <> v_user_id;

    IF v_member_count > 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'owner_must_transfer',
        'message', 'Transférez la propriété avant de quitter');
    ELSE
      DELETE FROM organizations WHERE id = p_organization_id;
      RETURN jsonb_build_object('success', true, 'action', 'organization_deleted');
    END IF;
  END IF;

  DELETE FROM user_organizations
  WHERE user_id = v_user_id AND organization_id = p_organization_id;

  RETURN jsonb_build_object('success', true, 'action', 'left');
END;
$$;

-- RPC : Transférer la propriété
CREATE OR REPLACE FUNCTION transfer_ownership(
  p_organization_id UUID,
  p_new_owner_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_current_role TEXT;
  v_target_role TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  SELECT role INTO v_current_role
  FROM user_organizations
  WHERE user_id = v_user_id AND organization_id = p_organization_id;

  IF v_current_role <> 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_owner');
  END IF;

  SELECT role INTO v_target_role
  FROM user_organizations
  WHERE user_id = p_new_owner_id AND organization_id = p_organization_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'target_not_member');
  END IF;

  IF v_user_id = p_new_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'same_user');
  END IF;

  UPDATE user_organizations SET role = 'admin'
  WHERE user_id = v_user_id AND organization_id = p_organization_id;

  UPDATE user_organizations SET role = 'owner'
  WHERE user_id = p_new_owner_id AND organization_id = p_organization_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
