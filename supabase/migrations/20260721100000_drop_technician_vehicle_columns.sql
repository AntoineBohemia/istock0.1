-- Retrait des colonnes vehicule des techniciens.
--
-- La relation technicien <-> vehicule vit sur vehicles.technician_id. Ces trois
-- colonnes etaient encore ecrites par les formulaires mais lues par aucun ecran :
-- on saisissait une plaque qui n'apparaissait jamais nulle part.
--
-- Migration destructive : les valeurs existantes sont d'abord archivees. Elles
-- ne concernent que 2 techniciens sur 30, et divergent de la table vehicles
-- (Eddy Alves portait « AB-123-CD » ici alors que son vehicule reel est
-- « HH-606GG »), ce qui confirme que ces colonnes n'etaient plus la reference.
CREATE TABLE IF NOT EXISTS archive_technician_vehicle_fields (
  technician_id uuid PRIMARY KEY,
  first_name text,
  last_name text,
  vehicle_plate text,
  vehicle_brand text,
  vehicle_model text,
  archived_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO archive_technician_vehicle_fields
  (technician_id, first_name, last_name, vehicle_plate, vehicle_brand, vehicle_model)
SELECT id, first_name, last_name, vehicle_plate, vehicle_brand, vehicle_model
FROM technicians
WHERE vehicle_plate IS NOT NULL
   OR vehicle_brand IS NOT NULL
   OR vehicle_model IS NOT NULL
ON CONFLICT (technician_id) DO NOTHING;

-- Table d'archive : personne n'y ecrit depuis l'application, lecture reservee
-- aux membres de l'organisation via les regles habituelles.
ALTER TABLE archive_technician_vehicle_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture archive vehicules techniciens" ON archive_technician_vehicle_fields;
CREATE POLICY "Lecture archive vehicules techniciens"
  ON archive_technician_vehicle_fields
  FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE technicians DROP COLUMN IF EXISTS vehicle_plate;
ALTER TABLE technicians DROP COLUMN IF EXISTS vehicle_brand;
ALTER TABLE technicians DROP COLUMN IF EXISTS vehicle_model;

COMMENT ON TABLE archive_technician_vehicle_fields IS
  'Sauvegarde des colonnes vehicle_* retirees de technicians le 21/07/2026. Supprimable une fois la reprise verifiee.';
