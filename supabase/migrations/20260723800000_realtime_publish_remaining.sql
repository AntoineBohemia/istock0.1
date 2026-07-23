-- Synchronisation temps réel : les tables qui manquaient.
--
-- Le socle « stock » (mouvements, produits, stock par société, outillage) était
-- déjà publié et écouté : deux comptes voyaient les entrées/sorties de l'autre
-- en direct. Mais véhicules, affectations de véhicules, fournisseurs,
-- techniciens et catégories ne l'étaient pas — une affectation de véhicule ou
-- un renommage restait invisible pour les autres comptes jusqu'à un
-- rechargement. Deux comptes divergeaient sur ces domaines.
--
-- On les ajoute à la publication `supabase_realtime`. L'écoute correspondante,
-- côté application, est ajoutée dans le même temps (hooks/use-realtime-sync.ts).
-- purchase_invoices y était déjà : seule l'écoute lui manquait.
--
-- IF NOT EXISTS via un bloc : ALTER PUBLICATION ne connaît pas cette clause, et
-- ré-ajouter une table déjà publiée échoue. On teste donc d'abord.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'vehicles',
    'vehicle_assignments',
    'suppliers',
    'technicians',
    'categories'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
