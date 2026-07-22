import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Vehicle {
  id: string;
  organization_id: string;
  name: string;
  license_plate: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
  fuel_type: string | null;
  mileage: number | null;
  technician_id: string | null;
  notes: string | null;
  photo_url: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleWithTechnician extends Vehicle {
  technician: {
    id: string;
    first_name: string;
    last_name: string;
    photo_url: string | null;
  } | null;
}

/**
 * Une periode de detention : ce technicien a eu ce vehicule de telle date a
 * telle date. `released_at` null = detention en cours.
 */
export interface VehicleAssignment {
  id: string;
  organization_id: string;
  vehicle_id: string;
  technician_id: string | null;
  assigned_at: string;
  released_at: string | null;
  mileage_start: number | null;
  mileage_end: number | null;
  notes: string | null;
  created_at: string;
  technician?: {
    id: string;
    first_name: string;
    last_name: string;
    photo_url: string | null;
  } | null;
  vehicle?: {
    id: string;
    name: string;
    license_plate: string;
    photo_url: string | null;
  } | null;
}

export interface VehicleDocument {
  id: string;
  vehicle_id: string;
  organization_id: string;
  document_type: string;
  label: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  uploaded_by: string | null;
}

// 'photo' alimente la galerie d'etat du vehicule (historique date).
export type DocumentType = "contract" | "revision" | "insurance" | "photo";

/**
 * Televerse la photo principale d'un vehicule et renvoie son URL publique.
 * Ne cree pas de ligne dans vehicle_documents : l'URL est stockee sur le vehicule.
 */
export async function uploadVehiclePhoto(file: File, vehicleId: string): Promise<string> {
  const supabase = createClient();

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${vehicleId}/photo/${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;

  const { error } = await supabase.storage
    .from("vehicle-documents")
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (error) {
    throw new Error(`Erreur lors de l'upload de la photo: ${error.message}`);
  }

  const { data } = supabase.storage.from("vehicle-documents").getPublicUrl(path);
  return data.publicUrl;
}

// ---------------------------------------------------------------------------
// Vehicle queries
// ---------------------------------------------------------------------------

export async function getVehicles(organizationId?: string): Promise<VehicleWithTechnician[]> {
  const supabase = createClient();

  let query = supabase
    .from("vehicles")
    .select("*, technician:technicians(id, first_name, last_name, photo_url)")
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erreur lors de la recuperation des vehicules: ${error.message}`);
  }

  return (data ?? []).map((v) => {
    const raw = v as Record<string, unknown>;
    const tech = raw.technician;
    return {
      ...(v as unknown as Vehicle),
      technician: Array.isArray(tech)
        ? (tech[0] ?? null)
        : (tech as VehicleWithTechnician["technician"]),
    };
  });
}

export async function getVehicle(id: string): Promise<VehicleWithTechnician | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("vehicles")
    .select("*, technician:technicians(id, first_name, last_name, photo_url)")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Erreur lors de la recuperation du vehicule: ${error.message}`);
  }

  const raw = data as Record<string, unknown>;
  const tech = raw.technician;
  return {
    ...(data as unknown as Vehicle),
    technician: Array.isArray(tech)
      ? (tech[0] ?? null)
      : (tech as VehicleWithTechnician["technician"]),
  };
}

// ---------------------------------------------------------------------------
// Vehicle CRUD
// ---------------------------------------------------------------------------

export async function createVehicle(
  organizationId: string,
  fields: {
    name: string;
    license_plate: string;
    brand?: string | null;
    model?: string | null;
    year?: number | null;
    vin?: string | null;
    fuel_type?: string | null;
    mileage?: number | null;
    technician_id?: string | null;
    notes?: string | null;
    photo_url?: string | null;
  }
): Promise<Vehicle> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      organization_id: organizationId,
      name: fields.name,
      license_plate: fields.license_plate,
      brand: fields.brand || null,
      model: fields.model || null,
      year: fields.year ?? null,
      vin: fields.vin || null,
      fuel_type: fields.fuel_type || null,
      mileage: fields.mileage ?? null,
      technician_id: fields.technician_id || null,
      notes: fields.notes || null,
      photo_url: fields.photo_url || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Erreur lors de la creation du vehicule: ${error.message}`);
  }

  return data as unknown as Vehicle;
}

export async function updateVehicle(
  id: string,
  fields: {
    name?: string;
    license_plate?: string;
    brand?: string | null;
    model?: string | null;
    year?: number | null;
    vin?: string | null;
    fuel_type?: string | null;
    mileage?: number | null;
    technician_id?: string | null;
    notes?: string | null;
    photo_url?: string | null;
  }
): Promise<Vehicle> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("vehicles")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Erreur lors de la mise a jour du vehicule: ${error.message}`);
  }

  return data as unknown as Vehicle;
}

// ---------------------------------------------------------------------------
// Historique de detention
// ---------------------------------------------------------------------------

/** Prend le premier element si Supabase a renvoye un tableau pour une relation. */
function firstOf<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return (value ?? null) as T | null;
}

/** Qui a detenu ce vehicule, de la periode en cours a la plus ancienne. */
export async function getVehicleAssignments(vehicleId: string): Promise<VehicleAssignment[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("vehicle_assignments")
    .select("*, technician:technicians(id, first_name, last_name, photo_url)")
    .eq("vehicle_id", vehicleId)
    .order("assigned_at", { ascending: false });

  if (error) {
    throw new Error(`Erreur lors de la recuperation de l'historique: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    ...(row as unknown as VehicleAssignment),
    technician: firstOf<NonNullable<VehicleAssignment["technician"]>>(
      (row as Record<string, unknown>).technician
    ),
  }));
}

/** Quels vehicules ce technicien a detenus, du plus recent au plus ancien. */
export async function getTechnicianVehicleHistory(
  technicianId: string
): Promise<VehicleAssignment[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("vehicle_assignments")
    .select("*, vehicle:vehicles(id, name, license_plate, photo_url)")
    .eq("technician_id", technicianId)
    .order("assigned_at", { ascending: false });

  if (error) {
    throw new Error(`Erreur lors de la recuperation de l'historique: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    ...(row as unknown as VehicleAssignment),
    vehicle: firstOf<NonNullable<VehicleAssignment["vehicle"]>>(
      (row as Record<string, unknown>).vehicle
    ),
  }));
}

/**
 * Change le detenteur d'un vehicule en enregistrant la passation.
 *
 * Tout se joue cote base (fonction assign_vehicle) : fermer la periode en
 * cours, ouvrir la suivante et mettre a jour le vehicule doivent aboutir
 * ensemble ou pas du tout. Fait en trois requetes depuis le client, une
 * coupure reseau laisserait un vehicule sans detenteur mais avec une periode
 * encore ouverte.
 *
 * @param technicianId null pour retirer l'assignation sans en creer de nouvelle.
 * @param mileage Releve du compteur a la passation. Met aussi a jour le vehicule.
 */
export async function assignVehicle(
  vehicleId: string,
  technicianId: string | null,
  mileage?: number | null,
  notes?: string | null
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.rpc("assign_vehicle", {
    p_vehicle_id: vehicleId,
    p_technician_id: technicianId,
    p_mileage: mileage ?? null,
    p_notes: notes?.trim() || null,
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Affecte (ou retire) le vehicule d'un technicien.
 *
 * La relation vit sur vehicles.technician_id : changer de vehicule veut donc
 * dire liberer l'ancien AVANT d'affecter le nouveau, sans quoi le technicien
 * se retrouverait avec deux vehicules a son nom.
 */
export async function setTechnicianVehicle(
  technicianId: string,
  nextVehicleId: string | null,
  previousVehicleId: string | null
): Promise<void> {
  if (previousVehicleId === nextVehicleId) return;

  if (previousVehicleId) {
    await updateVehicle(previousVehicleId, { technician_id: null });
  }
  if (nextVehicleId) {
    await updateVehicle(nextVehicleId, { technician_id: technicianId });
  }
}

export async function deleteVehicle(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("vehicles").delete().eq("id", id);

  if (error) {
    throw new Error(`Erreur lors de la suppression du vehicule: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Vehicle documents queries
// ---------------------------------------------------------------------------

export async function getVehicleDocuments(
  vehicleId: string,
  documentType?: DocumentType
): Promise<VehicleDocument[]> {
  const supabase = createClient();

  let query = supabase
    .from("vehicle_documents")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: false });

  if (documentType) {
    query = query.eq("document_type", documentType);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erreur lors de la recuperation des documents: ${error.message}`);
  }

  return (data as VehicleDocument[]) || [];
}

// ---------------------------------------------------------------------------
// Vehicle documents CRUD (with Storage)
// ---------------------------------------------------------------------------

export async function uploadVehicleDocument(
  file: File,
  vehicleId: string,
  organizationId: string,
  documentType: DocumentType,
  metadata: { label: string; validFrom?: string; validUntil?: string }
): Promise<VehicleDocument> {
  const supabase = createClient();

  // 1. Upload file to Storage
  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const path = `${vehicleId}/${documentType}/${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("vehicle-documents")
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (uploadError) {
    throw new Error(`Erreur lors de l'upload du fichier: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage.from("vehicle-documents").getPublicUrl(path);

  // 2. Insert metadata row
  const { data, error } = await supabase
    .from("vehicle_documents")
    .insert({
      vehicle_id: vehicleId,
      organization_id: organizationId,
      document_type: documentType,
      label: metadata.label,
      file_name: file.name,
      file_url: urlData.publicUrl,
      file_size: file.size,
      mime_type: file.type,
      valid_from: metadata.validFrom || null,
      valid_until: metadata.validUntil || null,
    })
    .select()
    .single();

  if (error) {
    // Cleanup uploaded file on DB insert failure
    await supabase.storage.from("vehicle-documents").remove([path]);
    throw new Error(`Erreur lors de l'enregistrement du document: ${error.message}`);
  }

  return data as unknown as VehicleDocument;
}

export async function deleteVehicleDocument(id: string, fileUrl: string): Promise<void> {
  const supabase = createClient();

  // 1. Remove file from Storage
  const parts = fileUrl.split("/vehicle-documents/");
  if (parts.length >= 2) {
    await supabase.storage.from("vehicle-documents").remove([parts[1]]);
  }

  // 2. Delete metadata row
  const { error } = await supabase.from("vehicle_documents").delete().eq("id", id);

  if (error) {
    throw new Error(`Erreur lors de la suppression du document: ${error.message}`);
  }
}
