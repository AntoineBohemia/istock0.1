-- Recalage du cache de stock global sur la somme des societes.
--
-- products.stock_current est un cache : la verite est dans
-- product_organization_stock, alimente par les mouvements. createProduct
-- ecrivait ce cache directement a la creation d'un produit, sans creer ni
-- ligne par societe ni mouvement — le produit naissait donc avec un total que
-- personne ne detenait. C'est l'origine des 25 unites fantomes de
-- « Test Peinture iStock » : 37 au cache, 12 chez les societes, 12 selon les
-- mouvements.
--
-- Le code ne peut plus produire cet ecart (createProduct force zero, le stock
-- de depart passe par une entree). Cette migration repare les donnees deja
-- ecrites.
--
-- Portee volontairement limitee aux consommables : l'outillage n'est pas
-- ventile par societe, recaler son cache sur une somme qui ne fait pas
-- autorite l'abimerait. « Outil test » presente d'ailleurs trois valeurs
-- discordantes (cache 3, societes 4, mouvements 1) et demande un arbitrage,
-- pas un recalage automatique.

-- 1. Archive de l'etat avant correction, pour pouvoir revenir en arriere.
create table if not exists archive_stock_cache_repair (
  product_id uuid not null,
  product_name text,
  stock_current_avant integer,
  stock_current_apres integer,
  repaired_at timestamptz not null default now()
);

insert into archive_stock_cache_repair (product_id, product_name, stock_current_avant, stock_current_apres)
select p.id, p.name, p.stock_current,
       coalesce((select sum(pos.stock_current) from product_organization_stock pos
                 where pos.product_id = p.id), 0)
from products p
where p.product_type = 'consumable'
  and p.stock_current is distinct from
      coalesce((select sum(pos.stock_current) from product_organization_stock pos
                where pos.product_id = p.id), 0);

-- 2. Recalage.
update products p
set stock_current = coalesce((select sum(pos.stock_current) from product_organization_stock pos
                              where pos.product_id = p.id), 0),
    updated_at = now()
where p.product_type = 'consumable'
  and p.stock_current is distinct from
      coalesce((select sum(pos.stock_current) from product_organization_stock pos
                where pos.product_id = p.id), 0);
