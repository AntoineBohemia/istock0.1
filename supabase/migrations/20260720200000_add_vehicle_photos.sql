-- Photo principale du vehicule + historique photo.
--
-- 1) photo_url : la photo affichee sur la carte et la fiche du vehicule.
-- 2) document_type accepte desormais 'photo' : l'historique photo reutilise
--    la table vehicle_documents (et son bucket, qui accepte deja les images),
--    ce qui evite une table et un bucket supplementaires.

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Elargit la contrainte existante sans rien supprimer d'autre
ALTER TABLE vehicle_documents DROP CONSTRAINT IF EXISTS vehicle_documents_document_type_check;

ALTER TABLE vehicle_documents
  ADD CONSTRAINT vehicle_documents_document_type_check
  CHECK (document_type IN ('contract', 'revision', 'insurance', 'photo'));
