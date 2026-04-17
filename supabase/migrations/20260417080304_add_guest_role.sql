-- T1: Autoriser le rôle 'guest' dans user_organizations et organization_invitations
-- Contexte : ajout d'un 4e rôle "invité" aux accès restreints (cf. IMPLEMENTATION_ROLE_GUEST.md)
-- Nettoyage : supprime aussi le doublon user_organizations_role_check + check_valid_role

-- Drop des anciennes contraintes (dont le doublon)
ALTER TABLE public.user_organizations DROP CONSTRAINT IF EXISTS check_valid_role;
ALTER TABLE public.user_organizations DROP CONSTRAINT IF EXISTS user_organizations_role_check;
ALTER TABLE public.organization_invitations DROP CONSTRAINT IF EXISTS organization_invitations_role_check;

-- Recréation avec 'guest'
-- user_organizations : 4 rôles possibles
ALTER TABLE public.user_organizations
  ADD CONSTRAINT user_organizations_role_check
  CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text, 'guest'::text]));

-- organization_invitations : pas de 'owner' (on n'invite pas en owner, on promeut via transfer_ownership)
ALTER TABLE public.organization_invitations
  ADD CONSTRAINT organization_invitations_role_check
  CHECK (role = ANY (ARRAY['admin'::text, 'member'::text, 'guest'::text]));
