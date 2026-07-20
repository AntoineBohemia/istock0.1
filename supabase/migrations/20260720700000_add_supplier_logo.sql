-- Logo des fournisseurs.
--
-- Le fichier est stocke dans le bucket public existant "product-images", sous le
-- prefixe suppliers/ : ses policies portent sur le bucket entier sans restriction
-- de chemin, aucune nouvelle regle de storage n'est donc necessaire.
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS logo_url text;

COMMENT ON COLUMN suppliers.logo_url IS
  'URL publique du logo (bucket product-images, prefixe suppliers/).';
