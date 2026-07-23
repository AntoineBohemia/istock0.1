-- Rejoindre le compte, c'est rejoindre toutes ses sociétés.
--
-- SMPR et SEIREN sont deux sociétés d'un même compte : même propriétaire,
-- catalogue commun, tout partagé. Un membre invité ne doit donc pas atterrir
-- dans une seule des deux — il doit voir exactement la même chose que les
-- autres, ce qui suppose d'appartenir aux deux.
--
-- « Les sociétés du compte » se définit sans rien coder en dur : ce sont les
-- organisations qui partagent le même propriétaire (rôle owner). Accepter une
-- invitation à l'une inscrit donc dans toutes celles du même propriétaire, avec
-- le même rôle. Ajouter une troisième société sous ce propriétaire l'inclura
-- automatiquement, sans nouvelle migration.

CREATE OR REPLACE FUNCTION public.accept_invitation_secure(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_invitation RECORD;
  v_org RECORD;
  v_owner_id UUID;
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

  -- Déjà membre de l'organisation invitée : on marque accepté et on s'arrête.
  IF EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = v_user_id AND organization_id = v_invitation.organization_id
  ) THEN
    UPDATE organization_invitations SET accepted_at = now() WHERE id = v_invitation.id;
    RETURN jsonb_build_object('success', false, 'error', 'already_member');
  END IF;

  -- Propriétaire de l'organisation invitée : il désigne le groupe de sociétés.
  SELECT user_id INTO v_owner_id
  FROM user_organizations
  WHERE organization_id = v_invitation.organization_id AND role = 'owner'
  LIMIT 1;

  -- Inscription dans toutes les sociétés du même propriétaire (l'invitée
  -- comprise), sauf celles où l'utilisateur est déjà membre. Même rôle partout.
  -- COALESCE : si l'invitée n'a pas de propriétaire identifiable, on retombe sur
  -- la seule organisation invitée plutôt que de ne rien insérer.
  INSERT INTO user_organizations (user_id, organization_id, role, is_default)
  SELECT v_user_id, o.id, v_invitation.role, false
  FROM organizations o
  WHERE (
      o.id = v_invitation.organization_id
      OR (v_owner_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM user_organizations owner_uo
        WHERE owner_uo.organization_id = o.id
          AND owner_uo.user_id = v_owner_id
          AND owner_uo.role = 'owner'
      ))
    )
    AND NOT EXISTS (
      SELECT 1 FROM user_organizations existing
      WHERE existing.user_id = v_user_id AND existing.organization_id = o.id
    );

  UPDATE organization_invitations SET accepted_at = now() WHERE id = v_invitation.id;

  SELECT id, name, slug, logo_url INTO v_org
  FROM organizations WHERE id = v_invitation.organization_id;

  RETURN jsonb_build_object(
    'success', true,
    'organization', jsonb_build_object(
      'id', v_org.id,
      'name', v_org.name,
      'slug', v_org.slug,
      'logo_url', v_org.logo_url
    ),
    'role', v_invitation.role
  );
END;
$$;

-- Reprise de l'existant : chaque membre actuel d'une société est ajouté aux
-- sociétés sœurs (même propriétaire) où il ne figure pas encore, avec le rôle
-- qu'il a déjà. Aligne les comptes déjà créés sur la règle « membre du compte =
-- membre de toutes ses sociétés ». Concrètement, ici, complète les rattachements
-- manquants entre SMPR et SEIREN.
INSERT INTO user_organizations (user_id, organization_id, role, is_default)
SELECT DISTINCT m.user_id, sibling.id, m.role, false
FROM user_organizations m
JOIN user_organizations owner_of_m
  ON owner_of_m.organization_id = m.organization_id AND owner_of_m.role = 'owner'
JOIN user_organizations owner_of_sibling
  ON owner_of_sibling.user_id = owner_of_m.user_id AND owner_of_sibling.role = 'owner'
JOIN organizations sibling
  ON sibling.id = owner_of_sibling.organization_id
WHERE sibling.id <> m.organization_id
  AND NOT EXISTS (
    SELECT 1 FROM user_organizations e
    WHERE e.user_id = m.user_id AND e.organization_id = sibling.id
  );
