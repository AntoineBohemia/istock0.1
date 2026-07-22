-- Statut d'activite d'une societe.
--
-- Le badge « Active » du tableau des organisations marquait en realite la
-- societe selectionnee dans le commutateur — un etat d'interface. On lisait
-- donc que SMPR etait active et SEIREN non, alors que les deux le sont.
--
-- Cette colonne porte le vrai statut : une societe desactivee disparait des
-- selecteurs, des filtres et des ecrans de saisie, mais ses donnees restent
-- intactes et consultables. Utile le jour ou une societe cesse son activite
-- sans qu'on veuille effacer son historique.
--
-- Additif et sans risque : la colonne est creee a `true`, donc toutes les
-- societes existantes restent actives et rien ne change tant que personne
-- n'en desactive une.

alter table public.organizations
  add column if not exists is_active boolean not null default true;

comment on column public.organizations.is_active is
  'Societe en activite. A false, elle disparait des selecteurs et des ecrans de saisie ; ses donnees restent consultables.';
