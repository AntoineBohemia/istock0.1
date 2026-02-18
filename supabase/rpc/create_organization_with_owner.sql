CREATE OR REPLACE FUNCTION create_organization_with_owner(
  org_name TEXT,
  org_slug TEXT,
  org_logo_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_org RECORD;
BEGIN
  -- Récupérer l'utilisateur connecté
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  -- Créer l'organisation
  INSERT INTO organizations (name, slug, logo_url)
  VALUES (org_name, org_slug, org_logo_url)
  RETURNING id, name, slug, logo_url
  INTO v_org;

  -- Créer le lien user_organizations avec role owner et is_default true
  INSERT INTO user_organizations (user_id, organization_id, role, is_default)
  VALUES (v_user_id, v_org.id, 'owner', true);

  RETURN jsonb_build_object(
    'id', v_org.id,
    'name', v_org.name,
    'slug', v_org.slug,
    'logo_url', v_org.logo_url
  );
END;
$$;
