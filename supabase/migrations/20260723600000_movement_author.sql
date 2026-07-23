-- ============================================================
-- Auteur d'un mouvement de stock
-- ============================================================
--
-- Le journal disait quoi, combien, quand et pour qui — jamais QUI avait agi.
-- Une entree, une sortie, une correction sont pourtant des gestes faits par une
-- personne connectee : sans l'auteur, une ligne fausse ne se remonte a personne
-- et une correction n'a pas de responsable.
--
-- L'auteur est un membre de l'organisation (le compte connecte), pas un
-- technicien : le technicien est le destinataire d'une sortie, l'auteur est
-- celui qui l'a saisie. Les deux peuvent differer et ne se confondent jamais.

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.stock_movements.created_by IS
  'Membre de l''organisation qui a saisi le mouvement. Null pour les mouvements anterieurs a ce suivi.';

-- Renseigne l'auteur a chaque insertion, quelle que soit la porte d'entree.
--
-- Un declencheur plutot que sept fonctions modifiees : create_stock_entry,
-- create_stock_exit, reverse_stock_movement, assign_equipment,
-- unassign_equipment, restock_technician et add_to_technician_inventory
-- inserent toutes dans stock_movements. Les reecrire une a une multipliait les
-- risques ; un seul point garantit que rien ne passe a travers, y compris les
-- ecritures directes et celles a venir.
--
-- auth.uid() lit le sujet du JWT de l'appelant. Il fonctionne meme appele
-- depuis une fonction SECURITY DEFINER : celle-ci change le role executant
-- (current_user), pas les claims de session que auth.uid() consulte.
--
-- On ne pose l'auteur que s'il est absent : un appel qui le fournit deja — une
-- reprise, un import — n'est pas ecrase.
CREATE OR REPLACE FUNCTION public.set_movement_author()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_movement_author ON public.stock_movements;
CREATE TRIGGER trg_set_movement_author
  BEFORE INSERT ON public.stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.set_movement_author();

-- La colonne servira a filtrer « les mouvements de tel membre » et a resoudre
-- les noms d'auteurs d'une page : un index leger sur une table qui grossit.
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_by
  ON public.stock_movements(created_by);
