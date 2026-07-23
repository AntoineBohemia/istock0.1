-- ============================================================
-- Etats des lieux des vehicules
-- ============================================================
--
-- Chaque semaine, un gestionnaire de compte verifie le vehicule d'un
-- technicien : proprete, carrosserie, tableau de bord... Jusqu'ici cela se
-- faisait sur une feuille papier, sans trace exploitable. Cette table enregistre
-- chaque controle : qui, quand, sur quel vehicule, avec quel kilometrage, et
-- l'etat point par point.
--
-- Les points controles sont stockes en JSON (`items`) plutot qu'en colonnes ou
-- table dediee : la grille evoluera (ajout de points interieur/exterieur) et on
-- ne veut pas une migration a chaque changement. Chaque item porte son libelle
-- au moment du controle, pour qu'un ancien etat des lieux reste lisible meme si
-- la grille change ensuite. Forme d'un item :
--   { "key": "pare_brise", "label": "Pare-brise",
--     "rating": "neuf|bon|correct|mauvais", "comment": "..." }
--
-- Les photos sont une galerie generale de l'etat des lieux (pas rattachees a un
-- point precis), d'ou un simple tableau d'URL.

CREATE TABLE public.vehicle_inspections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vehicle_id      UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,

  -- Qui a realise le controle. ON DELETE SET NULL : supprimer un compte ne doit
  -- pas effacer l'etat des lieux qu'il a saisi.
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Le moment du controle (le « jour, l'heure » demande a l'affichage).
  inspected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Conducteur habituel du vehicule au moment du controle. Texte libre :
  -- pre-rempli avec le detenteur, mais un vehicule peut etre conduit par
  -- quelqu'un qui n'est pas dans la liste des techniciens.
  driver_name     TEXT,

  -- Kilometrage releve pendant le controle.
  mileage         INTEGER,

  -- Points controles, avec leur note et leur commentaire (voir en-tete).
  items           JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Galerie de photos de l'etat des lieux.
  photo_urls      TEXT[] NOT NULL DEFAULT '{}',

  -- Observation generale.
  note            TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicle_inspections_vehicle ON public.vehicle_inspections(vehicle_id, inspected_at DESC);
CREATE INDEX idx_vehicle_inspections_org     ON public.vehicle_inspections(organization_id);

-- ============================================================
-- RLS — meme decoupage que public.vehicles / vehicle_assignments
-- ============================================================

ALTER TABLE public.vehicle_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select_vehicle_inspections" ON public.vehicle_inspections
  FOR SELECT
  USING (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "org_insert_vehicle_inspections" ON public.vehicle_inspections
  FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "org_update_vehicle_inspections" ON public.vehicle_inspections
  FOR UPDATE
  USING (organization_id IN (SELECT public.get_user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "org_delete_vehicle_inspections" ON public.vehicle_inspections
  FOR DELETE
  USING (organization_id IN (SELECT public.get_user_organization_ids()));

-- Un membre simple ne modifie pas le parc : seuls owner/admin ecrivent.
CREATE POLICY "member_no_insert_vehicle_inspections" ON public.vehicle_inspections
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

CREATE POLICY "member_no_update_vehicle_inspections" ON public.vehicle_inspections
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_org_admin_or_owner(organization_id))
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

CREATE POLICY "member_no_delete_vehicle_inspections" ON public.vehicle_inspections
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_org_admin_or_owner(organization_id));

-- ============================================================
-- create_vehicle_inspection : enregistrer + mettre a jour le km
-- ============================================================
--
-- Une seule porte d'entree : l'etat des lieux est ecrit et, dans la foulee, le
-- kilometrage du vehicule est rafraichi. Passer par une fonction evite l'etat
-- batard ou l'un reussirait sans l'autre. Le compteur ne recule jamais (un
-- releve inferieur au dernier connu, faute de frappe probable, est archive dans
-- l'etat des lieux mais ne redescend pas le vehicule).

CREATE OR REPLACE FUNCTION public.create_vehicle_inspection(
  p_vehicle_id  UUID,
  p_driver_name TEXT DEFAULT NULL,
  p_mileage     INTEGER DEFAULT NULL,
  p_items       JSONB DEFAULT '[]'::jsonb,
  p_photo_urls  TEXT[] DEFAULT '{}',
  p_note        TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vehicle       public.vehicles%ROWTYPE;
  v_inspection_id UUID;
BEGIN
  SELECT * INTO v_vehicle FROM public.vehicles WHERE id = p_vehicle_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vehicule introuvable';
  END IF;

  IF NOT public.is_org_admin_or_owner(v_vehicle.organization_id) THEN
    RAISE EXCEPTION 'Droits insuffisants';
  END IF;

  INSERT INTO public.vehicle_inspections
    (organization_id, vehicle_id, created_by, driver_name, mileage, items, photo_urls, note)
  VALUES
    (v_vehicle.organization_id, p_vehicle_id, auth.uid(), p_driver_name, p_mileage,
     COALESCE(p_items, '[]'::jsonb), COALESCE(p_photo_urls, '{}'), p_note)
  RETURNING id INTO v_inspection_id;

  -- Rafraichit le compteur du vehicule, sans jamais le faire reculer.
  IF p_mileage IS NOT NULL
     AND (v_vehicle.mileage IS NULL OR p_mileage >= v_vehicle.mileage) THEN
    UPDATE public.vehicles
       SET mileage = p_mileage, updated_at = now()
     WHERE id = p_vehicle_id;
  END IF;

  RETURN v_inspection_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_vehicle_inspection(UUID, TEXT, INTEGER, JSONB, TEXT[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_vehicle_inspection(UUID, TEXT, INTEGER, JSONB, TEXT[], TEXT) TO authenticated;

-- Synchronisation temps reel : un etat des lieux valide sur le telephone doit
-- apparaitre sur l'ordinateur sans rechargement.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'vehicle_inspections'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_inspections';
  END IF;
END $$;

COMMENT ON TABLE public.vehicle_inspections IS
  'Etats des lieux hebdomadaires des vehicules : notes point par point, km, photos.';
