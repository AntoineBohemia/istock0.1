-- Suppression des techniciens n'appartenant ni a SMPR ni a SEIREN.
--
-- La base porte onze societes, dont neuf sont des residus de tests sans aucun
-- membre. Leurs techniciens polluaient les listes desormais que celles-ci
-- couvrent toutes les societes du compte.
--
-- Consequences, verifiees sur les cles etrangeres avant execution :
--   technician_inventory          ON DELETE CASCADE  -> supprime
--   technician_inventory_history  ON DELETE CASCADE  -> supprime
--   stock_movements               ON DELETE SET NULL -> conserves, lien efface
--   equipment_assignments         ON DELETE NO ACTION-> aucun concerne
--   vehicles                      ON DELETE SET NULL -> aucun concerne
--
-- Les mouvements survivent donc a la suppression : ils appartiennent aux
-- societes de test, invisibles depuis le compte de production, et les detruire
-- fausserait les historiques de stock de ces societes si elles reprenaient vie.

-- Archive complete avant suppression : la table conserve de quoi recreer les
-- fiches si l'une d'elles s'averait utile.
create table if not exists archive_removed_technicians as
select t.*, o.name as organization_name, now() as removed_at
from technicians t
left join organizations o on o.id = t.organization_id
where false;

insert into archive_removed_technicians
select t.*, o.name, now()
from technicians t
left join organizations o on o.id = t.organization_id
where t.organization_id is null
   or o.name not in ('SMPR', 'SEIREN');

delete from technicians t
using organizations o
where o.id = t.organization_id
  and o.name not in ('SMPR', 'SEIREN');

-- Techniciens orphelins (aucune societe) : la jointure ci-dessus les ignore.
delete from technicians where organization_id is null;
