-- Factures d'achat rattachees aux entrees de stock.
--
-- La facture appartient a l'ENTREE (l'achat), pas au produit : une meme facture
-- peut couvrir plusieurs produits, et c'est l'entree qui porte deja la date, la
-- quantite, le prix, le fournisseur et la reference de facture.
--
-- On stocke le CHEMIN du fichier (pas une URL) car le bucket est prive :
-- l'affichage passe par un lien signe temporaire.

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS invoice_path TEXT;

-- ============================================================
-- Bucket prive : documents comptables
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'purchase-invoices',
  'purchase-invoices',
  false,
  10485760,  -- 10 Mo
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Acces reserve aux utilisateurs authentifies
DROP POLICY IF EXISTS "Authenticated can upload purchase invoices" ON storage.objects;
CREATE POLICY "Authenticated can upload purchase invoices"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'purchase-invoices');

DROP POLICY IF EXISTS "Authenticated can read purchase invoices" ON storage.objects;
CREATE POLICY "Authenticated can read purchase invoices"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'purchase-invoices');

DROP POLICY IF EXISTS "Authenticated can delete purchase invoices" ON storage.objects;
CREATE POLICY "Authenticated can delete purchase invoices"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'purchase-invoices');
