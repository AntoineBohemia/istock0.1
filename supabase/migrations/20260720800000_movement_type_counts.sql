-- Nombre de mouvements par type.
--
-- Les pastilles de filtre affichaient un compte deduit du tableau charge en
-- memoire. La page passant a une pagination serveur, ce tableau ne contient
-- plus qu'une page : sans cette fonction, les compteurs afficheraient « 20 »
-- au lieu du total reel.
--
-- DROP explicite : un CREATE OR REPLACE avec une signature differente cree une
-- SECONDE surcharge au lieu de remplacer, et les appels deviennent ambigus.
DROP FUNCTION IF EXISTS get_movement_type_counts();

CREATE FUNCTION get_movement_type_counts()
RETURNS TABLE (movement_type text, count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT m.movement_type::text, COUNT(*)
  FROM stock_movements m
  GROUP BY m.movement_type;
$$;

COMMENT ON FUNCTION get_movement_type_counts() IS
  'Nombre de mouvements par type, pour les pastilles de filtre de la page Mouvements.';
