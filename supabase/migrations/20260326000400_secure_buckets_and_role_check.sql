-- Sécuriser les buckets storage : limite 2MB + types images uniquement
UPDATE storage.buckets
SET file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']
WHERE name IN ('product-images', 'organization-logos');

-- Contrainte CHECK sur le rôle pour empêcher les valeurs invalides
ALTER TABLE user_organizations
  ADD CONSTRAINT check_valid_role CHECK (role IN ('owner', 'admin', 'member'));
