-- ============================================================
-- Historique de detention des vehicules
-- ============================================================
--
-- vehicles.technician_id ne dit que qui detient le vehicule maintenant :
-- chaque reassignation ecrasait la precedente, sans laisser de trace. On ne
-- pouvait donc repondre ni a « qui avait ce vehicule en mars ? », ni a
-- « depuis combien de temps l'a-t-il ? ».
--
-- Cette table enregistre des periodes de detention. Une periode ouverte
-- (released_at null) est la detention en cours ; il ne peut y en avoir qu'une
-- a la fois par vehicule, ce qu'un index unique partiel garantit.
--
-- Le kilometrage est releve aux deux bouts : la difference donne les km
-- parcourus par ce technicien avec ce vehicule, ce qui est en general le vrai
-- interet d'un historique de flotte.

CREATE TABLE public.vehicle_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vehicle_id      UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,

  -- ON DELETE SET NULL : supprimer un technicien ne doit pas effacer le fait
  -- que le vehicule a ete detenu pendant cette periode.
  technician_id   UUID REFERENCES public.technicians(id) ON DELETE SET NULL,

  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at     TIMESTAMPTZ,

  -- Kilometrage releve a la remise et au retour.
  mileage_start   INTEGER,
  mileage_end     INTEGER,

  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Une periode ne peut pas se terminer avant d'avoir commence.
  CONSTRAINT vehicle_assignments_dates_ordered
    CHECK (released_at IS NULL OR released_at >= assigned_at)
);

CREATE INDEX idx_vehicle_assignments_vehicle    ON public.vehicle_assignments(vehicle_id, assigned_at DESC);
CREATE INDEX idx_vehicle_assignments_technician ON public.vehicle_assignments(technician_id, assigned_at DESC);
CREATE INDEX idx_vehicle_assignments_org        ON public.vehicle_assignments(organization_id);

-- Un seul detenteur a la fois : c'est ce qui empeche l'historique de se
-- desynchroniser de vehicles.technician_id.
CREATE UNIQUE INDEX idx_vehicle_assignments_one_open
  ON public.vehicle_assignments(vehicle_id)
  WHERE released_at IS NULL;

-- ============================================================
-- RLS — meme decoupage que public.vehicles
-- ============================================================

ALTER TABLE public.vehicle_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select_vehicle_assignments" ON public.vehicle_assignments
  FOR SELECT
  USING (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "org_insert_vehicle_assignments" ON public.vehicle_assignments
  FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "org_update_vehicle_assignments" ON public.vehicle_assignments
  FOR UPDATE
  USING (organization_id IN (SELECT public.get_user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "org_delete_vehicle_assignments" ON public.vehicle_assignments
  FOR DELETE
  USING (organization_id IN (SELECT public.get_user_organization_ids()));

CREATE POLICY "member_no_insert_vehicle_assignments" ON public.vehicle_assignments
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

CREATE POLICY "member_no_update_vehicle_assignments" ON public.vehicle_assignments
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_org_admin_or_owner(organization_id))
  WITH CHECK (public.is_org_admin_or_owner(organization_id));

CREATE POLICY "member_no_delete_vehicle_assignments" ON public.vehicle_assignments
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_org_admin_or_owner(organization_id));

-- ============================================================
-- Filet de securite : toute ecriture sur vehicles.technician_id
-- ============================================================
--
-- L'assignation passe par assign_vehicle() ci-dessous, mais technician_id
-- reste modifiable par un simple UPDATE (formulaire d'edition, correction a
-- la main, script). Ce declencheur garantit que l'historique suit, quelle que
-- soit la porte d'entree.
--
-- Il est volontairement idempotent : si une periode ouverte correspond deja au
-- nouveau technicien — le cas quand assign_vehicle vient de l'inserer — il ne
-- fait rien. C'est ce qui evite les doublons.

CREATE OR REPLACE FUNCTION public.sync_vehicle_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.technician_id IS NOT DISTINCT FROM OLD.technician_id THEN
    RETURN NEW;
  END IF;

  -- Fermer la detention en cours si elle ne concerne plus le bon technicien.
  UPDATE public.vehicle_assignments
     SET released_at = now(),
         mileage_end = COALESCE(mileage_end, NEW.mileage)
   WHERE vehicle_id = NEW.id
     AND released_at IS NULL
     AND technician_id IS DISTINCT FROM NEW.technician_id;

  IF NEW.technician_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.vehicle_assignments
     WHERE vehicle_id = NEW.id
       AND released_at IS NULL
       AND technician_id = NEW.technician_id
  ) THEN
    INSERT INTO public.vehicle_assignments
      (organization_id, vehicle_id, technician_id, assigned_at, mileage_start)
    VALUES
      (NEW.organization_id, NEW.id, NEW.technician_id, now(), NEW.mileage);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_vehicle_assignment
  AFTER INSERT OR UPDATE OF technician_id ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_vehicle_assignment();

-- ============================================================
-- assign_vehicle : la porte d'entree applicative
-- ============================================================
--
-- Passer par une fonction plutot que par deux ecritures cote client evite
-- l'etat batard ou la periode serait fermee sans que le vehicule change de
-- main. Le kilometrage releve sert aux deux bouts : fin de la periode qui se
-- termine, debut de celle qui commence, et mise a jour du compteur du
-- vehicule.

CREATE OR REPLACE FUNCTION public.assign_vehicle(
  p_vehicle_id    UUID,
  p_technician_id UUID DEFAULT NULL,
  p_mileage       INTEGER DEFAULT NULL,
  p_notes         TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vehicle       public.vehicles%ROWTYPE;
  v_assignment_id UUID;
BEGIN
  SELECT * INTO v_vehicle FROM public.vehicles WHERE id = p_vehicle_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vehicule introuvable';
  END IF;

  IF NOT public.is_org_admin_or_owner(v_vehicle.organization_id) THEN
    RAISE EXCEPTION 'Droits insuffisants';
  END IF;

  -- Un kilometrage ne peut que monter : le refuser ici evite qu'une faute de
  -- frappe rende negatif le nombre de km parcourus par le detenteur suivant.
  IF p_mileage IS NOT NULL AND v_vehicle.mileage IS NOT NULL AND p_mileage < v_vehicle.mileage THEN
    RAISE EXCEPTION 'Kilometrage inferieur au dernier releve (%)', v_vehicle.mileage;
  END IF;

  -- Cloture de la detention en cours.
  UPDATE public.vehicle_assignments
     SET released_at = now(),
         mileage_end = COALESCE(p_mileage, mileage_end),
         notes       = COALESCE(notes, p_notes)
   WHERE vehicle_id = p_vehicle_id
     AND released_at IS NULL
     AND technician_id IS DISTINCT FROM p_technician_id;

  -- Ouverture de la nouvelle, sauf si ce technicien detient deja le vehicule
  -- (cas d'un simple releve de kilometrage sans changement de main).
  IF p_technician_id IS NOT NULL THEN
    SELECT id INTO v_assignment_id
      FROM public.vehicle_assignments
     WHERE vehicle_id = p_vehicle_id
       AND released_at IS NULL
       AND technician_id = p_technician_id;

    IF v_assignment_id IS NULL THEN
      INSERT INTO public.vehicle_assignments
        (organization_id, vehicle_id, technician_id, assigned_at, mileage_start, notes)
      VALUES
        (v_vehicle.organization_id, p_vehicle_id, p_technician_id, now(), p_mileage, p_notes)
      RETURNING id INTO v_assignment_id;
    ELSIF p_notes IS NOT NULL THEN
      UPDATE public.vehicle_assignments SET notes = p_notes WHERE id = v_assignment_id;
    END IF;
  END IF;

  -- Le declencheur ne fera rien : la periode ouverte correspond deja.
  UPDATE public.vehicles
     SET technician_id = p_technician_id,
         mileage       = COALESCE(p_mileage, mileage),
         updated_at    = now()
   WHERE id = p_vehicle_id;

  RETURN v_assignment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_vehicle(UUID, UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_vehicle(UUID, UUID, INTEGER, TEXT) TO authenticated;

-- ============================================================
-- Reprise de l'existant
-- ============================================================
--
-- Les vehicules deja assignes n'ont aucune date de debut connue : l'historique
-- demarre aujourd'hui, comme convenu. Les durees affichees pour eux comptent
-- donc a partir de cette migration, pas depuis leur remise reelle.

INSERT INTO public.vehicle_assignments
  (organization_id, vehicle_id, technician_id, assigned_at, mileage_start)
SELECT v.organization_id, v.id, v.technician_id, now(), v.mileage
  FROM public.vehicles v
 WHERE v.technician_id IS NOT NULL
   AND v.archived_at IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.vehicle_assignments a
      WHERE a.vehicle_id = v.id AND a.released_at IS NULL
   );

COMMENT ON TABLE public.vehicle_assignments IS
  'Periodes de detention d''un vehicule par un technicien. released_at null = detention en cours.';
