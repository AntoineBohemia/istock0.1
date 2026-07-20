-- Lien web de l'article (fiche produit chez le fournisseur, page fabricant...).
-- Permet de retrouver la reference d'origine sans quitter l'application.

ALTER TABLE products ADD COLUMN IF NOT EXISTS product_url TEXT;
