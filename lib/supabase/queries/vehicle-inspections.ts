import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";

// ─── Grille de controle ─────────────────────────────────────
// Extensible : ajouter un point ici suffit, aucune migration. Chaque etat des
// lieux fige les libelles au moment du controle (voir la table), donc modifier
// cette liste n'altere pas les anciens.
export const INSPECTION_ITEMS: { key: string; label: string }[] = [
  { key: "tableau_de_bord", label: "Tableau de bord" },
  { key: "retroviseurs", label: "Rétroviseurs" },
  { key: "aspect_portieres", label: "Aspect des portières" },
  { key: "etat_tapis", label: "État des tapis" },
  { key: "sieges", label: "Sièges" },
  { key: "proprete_interieur", label: "Propreté intérieur" },
  { key: "proprete_exterieur", label: "Propreté extérieur" },
  { key: "pare_brise", label: "Pare-brise" },
];

export type InspectionRating = "neuf" | "bon" | "correct" | "mauvais";

/** Du meilleur au pire — l'ordre porte le degrade de couleur a l'ecran. */
export const RATING_ORDER: InspectionRating[] = ["neuf", "bon", "correct", "mauvais"];

export const RATING_LABELS: Record<InspectionRating, string> = {
  neuf: "Neuf",
  bon: "Bon",
  correct: "Correct",
  mauvais: "Mauvais",
};

export interface InspectionItem {
  key: string;
  label: string;
  rating: InspectionRating | null;
  comment: string;
}

export interface VehicleInspection {
  id: string;
  organization_id: string;
  vehicle_id: string;
  created_by: string | null;
  inspected_at: string;
  driver_name: string | null;
  mileage: number | null;
  items: InspectionItem[];
  photo_urls: string[];
  note: string | null;
  created_at: string;
  /** Nom de l'auteur, resolu depuis la vue des membres (pas en base). */
  author_name: string | null;
}

/**
 * Etats des lieux d'un vehicule, du plus recent au plus ancien.
 *
 * Le nom de l'auteur n'est pas stocke : on le resout depuis
 * organization_members_view, en une requete pour tout le lot.
 */
export async function getVehicleInspections(vehicleId: string): Promise<VehicleInspection[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("vehicle_inspections")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("inspected_at", { ascending: false });

  if (error) {
    throw new Error(`Erreur lors de la récupération des états des lieux: ${error.message}`);
  }

  const rows = (data ?? []).map((r) => ({
    ...r,
    items: (r.items as unknown as InspectionItem[]) ?? [],
    author_name: null as string | null,
  })) as VehicleInspection[];

  const authorIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
  if (authorIds.length > 0) {
    const { data: members } = await supabase
      .from("organization_members_view")
      .select("user_id, display_name, email")
      .in("user_id", authorIds);
    const nameById = new Map<string, string>();
    for (const m of members ?? []) {
      if (m.user_id) nameById.set(m.user_id, m.display_name || m.email || "");
    }
    for (const r of rows) {
      r.author_name = r.created_by ? (nameById.get(r.created_by) ?? null) : null;
    }
  }

  return rows;
}

/**
 * Enregistre un etat des lieux et rafraichit le kilometrage du vehicule.
 * Passe par la RPC create_vehicle_inspection (atomique, controle des droits,
 * compteur qui ne recule pas).
 */
export async function createVehicleInspection(params: {
  vehicleId: string;
  driverName?: string | null;
  mileage?: number | null;
  items: InspectionItem[];
  photoUrls: string[];
  note?: string | null;
}): Promise<string> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("create_vehicle_inspection", {
    p_vehicle_id: params.vehicleId,
    p_driver_name: params.driverName ?? undefined,
    p_mileage: params.mileage ?? undefined,
    p_items: params.items as unknown as never,
    p_photo_urls: params.photoUrls,
    p_note: params.note ?? undefined,
  });

  if (error) {
    throw new Error(`Erreur lors de l'enregistrement de l'état des lieux: ${error.message}`);
  }

  return data as string;
}

/**
 * Corrige un etat des lieux existant.
 *
 * Ecriture directe sur la ligne (le RLS reserve deja la modification a
 * owner/admin). Contrairement a la creation, on ne retouche pas le kilometrage
 * du vehicule : il a ete pose au moment du controle, corriger la fiche a
 * posteriori ne doit pas le faire bouger tout seul.
 */
export async function updateVehicleInspection(
  id: string,
  params: {
    driverName?: string | null;
    mileage?: number | null;
    items: InspectionItem[];
    photoUrls: string[];
    note?: string | null;
  }
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("vehicle_inspections")
    .update({
      driver_name: params.driverName ?? null,
      mileage: params.mileage ?? null,
      items: params.items as unknown as Json,
      photo_urls: params.photoUrls,
      note: params.note ?? null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Erreur lors de la mise à jour de l'état des lieux: ${error.message}`);
  }
}

/** Supprime un etat des lieux. Reserve a owner/admin par le RLS. */
export async function deleteVehicleInspection(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("vehicle_inspections").delete().eq("id", id);

  if (error) {
    throw new Error(`Erreur lors de la suppression de l'état des lieux: ${error.message}`);
  }
}

/**
 * Televerse une photo d'etat des lieux.
 *
 * Reutilise le bucket public "vehicle-documents", sous le prefixe inspections/
 * du vehicule : memes policies que le reste des pieces du vehicule.
 */
export async function uploadInspectionPhoto(file: File, vehicleId: string): Promise<string> {
  const supabase = createClient();

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${vehicleId}/inspections/${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;

  const { error } = await supabase.storage
    .from("vehicle-documents")
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (error) {
    throw new Error(`Erreur lors de l'upload de la photo: ${error.message}`);
  }

  const { data } = supabase.storage.from("vehicle-documents").getPublicUrl(path);
  return data.publicUrl;
}
