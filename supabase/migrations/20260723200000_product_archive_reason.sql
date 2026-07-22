-- Motif d'archivage d'un produit.
--
-- Archiver un outil disait jusqu'ici qu'il avait quitte le catalogue, jamais
-- pourquoi. Or la raison est justement ce qu'on cherche des mois plus tard :
-- un outil casse, perdu ou vole ne raconte pas la meme chose sur la flotte
-- qu'un outil simplement remplace par un modele plus recent.
--
-- Colonne libre plutot que liste fermee : les cas reels ne rentrent pas dans
-- une nomenclature decidee a l'avance. Si un vocabulaire stable emerge a
-- l'usage, il sera temps de le figer.
--
-- Additif et sans risque : la colonne est nullable, les produits deja
-- archives restent archives avec un motif vide. Elle est remise a null a la
-- restauration, cote application : un produit revenu au catalogue n'a plus de
-- motif de sortie.

alter table public.products
  add column if not exists archive_reason text;

comment on column public.products.archive_reason is
  'Motif saisi lors de l''archivage (casse, perdu, vole, remplace...). Null tant que le produit est au catalogue.';
