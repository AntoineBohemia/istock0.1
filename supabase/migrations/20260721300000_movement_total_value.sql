-- Montant d'un mouvement, en colonne generee.
--
-- Le tableau des mouvements affiche « quantite x prix unitaire ». Trier sur ce
-- montant demandait de le calculer cote navigateur — donc sur la page courante
-- seulement, ce qui donne un classement faux des que la liste est paginee.
--
-- STORED plutot que calcule a la volee : la valeur est lue bien plus souvent
-- qu'ecrite, et Postgres peut alors l'indexer.
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS total_value numeric
  GENERATED ALWAYS AS (quantity * COALESCE(unit_price, 0)) STORED;

COMMENT ON COLUMN stock_movements.total_value IS
  'Montant du mouvement (quantite x prix unitaire). Colonne generee, en lecture seule.';

-- Index sur (total_value, created_at) : le tri par montant garde un
-- departage stable par date, sinon deux montants egaux changent d'ordre
-- d'une page a l'autre.
CREATE INDEX IF NOT EXISTS idx_stock_movements_total_value
  ON stock_movements (total_value DESC, created_at DESC);
