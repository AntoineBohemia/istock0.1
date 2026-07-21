-- Synchronisation temps reel entre le telephone et l'ordinateur.
--
-- Un mouvement saisi sur le terrain n'apparaissait sur le poste du bureau
-- qu'apres un rechargement manuel : deux personnes travaillant en meme temps
-- voyaient deux stocks differents. Publier ces tables permet au client de
-- s'abonner aux changements et de reactualiser ses ecrans.
--
-- Additif : aucune donnee modifiee, aucune colonne touchee. La publication ne
-- fait que diffuser les changements deja ecrits.
--
-- REPLICA IDENTITY reste par defaut (cle primaire) : on ne diffuse que
-- l'identifiant des lignes touchees, ce qui suffit a declencher une
-- reactualisation et evite de faire transiter le contenu des lignes.

do $$
declare
  t text;
begin
  foreach t in array array[
    'stock_movements',            -- entrees, sorties, corrections
    'products',                   -- stock global, prix, archivage
    'product_organization_stock', -- stock par societe
    'equipment_assignments',      -- outillage prete aux techniciens
    'purchase_invoices'           -- factures rattachees aux achats
  ]
  loop
    -- Idempotent : rejouer la migration ne doit pas echouer sur une table
    -- deja publiee.
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
