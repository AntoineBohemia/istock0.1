-- Vue exposant les membres avec leurs metadata (email, nom, avatar)
-- Permet d'éviter les requêtes directes sur auth.users (schéma protégé)
CREATE OR REPLACE VIEW public.organization_members_view AS
SELECT
  uo.id,
  uo.user_id,
  uo.organization_id,
  uo.role,
  uo.is_default,
  uo.created_at AS joined_at,
  u.email,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    NULLIF(CONCAT(
      u.raw_user_meta_data->>'first_name',
      ' ',
      u.raw_user_meta_data->>'last_name'
    ), ' '),
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1)
  ) AS display_name,
  u.raw_user_meta_data->>'avatar_url' AS avatar_url
FROM user_organizations uo
JOIN auth.users u ON u.id = uo.user_id;

GRANT SELECT ON public.organization_members_view TO authenticated;
