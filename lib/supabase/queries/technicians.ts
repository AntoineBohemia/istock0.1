import { createClient } from "@/lib/supabase/client";

export interface Technician {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  photo_url: string | null;
  supplier_id: string | null;
  tablet_ref: string | null;
  clothing_size_top: string | null;
  clothing_size_bottom: string | null;
  organization_id: string | null;
  created_at: string | null;
  archived_at: string | null;
}

export interface TechnicianInventoryItem {
  id: string;
  technician_id: string;
  product_id: string;
  quantity: number;
  assigned_at: string | null;
  organization_id: string | null;
  product?: {
    id: string;
    name: string;
    sku: string;
    image_url: string | null;
  };
}

export interface TechnicianWithInventory extends Technician {
  inventory: TechnicianInventoryItem[];
  inventory_count: number;
  year_units_total: number;
  last_restock_at: string | null;
  organization_name?: string | null;
  equipment_count?: number;
}

export interface TechnicianInventoryHistorySnapshot {
  items: Array<{
    product_id: string;
    product_name: string;
    product_sku: string | null;
    quantity: number;
  }>;
  total_items: number;
}

export interface TechnicianInventoryHistoryEntry {
  id: string;
  technician_id: string;
  organization_id: string | null;
  snapshot: TechnicianInventoryHistorySnapshot;
  created_at: string | null;
}

export interface CreateTechnicianData {
  organization_id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  photo_url?: string | null;
  tablet_ref?: string | null;
  clothing_size_top?: string | null;
  clothing_size_bottom?: string | null;
}

export type UpdateTechnicianData = Partial<CreateTechnicianData>;

/**
 * Récupère la liste des techniciens avec leur nombre d'items en inventaire
 * Utilise une RPC pour tout faire en une seule requête SQL (JOIN + aggregation)
 */
export async function getTechnicians(
  organizationId?: string,
  year?: number
): Promise<TechnicianWithInventory[]> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_technicians_with_stats", {
    p_organization_id: organizationId,
    p_year: year,
  });

  if (error) {
    throw new Error(`Erreur lors de la récupération des techniciens: ${error.message}`);
  }

  return (data as unknown as TechnicianWithInventory[]) || [];
}

/**
 * Récupère un technicien par son ID avec son inventaire actuel
 */
export async function getTechnician(id: string): Promise<TechnicianWithInventory | null> {
  const supabase = createClient();

  const { data: technician, error: techError } = await supabase
    .from("technicians")
    .select("*")
    .eq("id", id)
    .single();

  if (techError) {
    if (techError.code === "PGRST116") {
      return null;
    }
    throw new Error(`Erreur lors de la récupération du technicien: ${techError.message}`);
  }

  // Récupérer l'inventaire avec les détails des produits
  const { data: inventory, error: invError } = await supabase
    .from("technician_inventory")
    .select(
      `
      *,
      product:products(id, name, sku, image_url)
    `
    )
    .eq("technician_id", id);

  if (invError) {
    throw new Error(`Erreur lors de la récupération de l'inventaire: ${invError.message}`);
  }

  // Récupérer le dernier restock
  const { data: lastHistory } = await supabase
    .from("technician_inventory_history")
    .select("created_at")
    .eq("technician_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Total unités sorties cette année civile
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
  const { data: yearMovements } = await supabase
    .from("stock_movements")
    .select("quantity, reversed_quantity")
    .eq("technician_id", id)
    .eq("movement_type", "exit_technician")
    .is("reverses_movement_id", null)
    .gte("created_at", yearStart);

  // Quantite nette : une sortie corrigee n'a pas ete consommee par le technicien
  const yearUnitsTotal =
    yearMovements?.reduce((sum, m) => sum + m.quantity - (m.reversed_quantity ?? 0), 0) || 0;
  const inventoryCount = inventory?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return {
    ...technician,
    inventory: inventory || [],
    inventory_count: inventoryCount,
    year_units_total: yearUnitsTotal,
    last_restock_at: lastHistory?.created_at || null,
  };
}

/**
 * Crée un nouveau technicien
 */
export async function createTechnician(data: CreateTechnicianData): Promise<Technician> {
  const supabase = createClient();

  const { data: technician, error } = await supabase
    .from("technicians")
    .insert({
      organization_id: data.organization_id,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email || null,
      phone: data.phone || null,
      city: data.city || null,
      photo_url: data.photo_url || null,
      tablet_ref: data.tablet_ref || null,
      clothing_size_top: data.clothing_size_top || null,
      clothing_size_bottom: data.clothing_size_bottom || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Un technicien avec cet email existe déjà");
    }
    throw new Error(`Erreur lors de la création du technicien: ${error.message}`);
  }

  return technician;
}

/**
 * Met à jour un technicien existant
 */
export async function updateTechnician(
  id: string,
  data: UpdateTechnicianData,
  organizationId?: string
): Promise<Technician> {
  const supabase = createClient();

  const updateData: Record<string, unknown> = {};

  if (data.first_name !== undefined) updateData.first_name = data.first_name;
  if (data.last_name !== undefined) updateData.last_name = data.last_name;
  if (data.email !== undefined) updateData.email = data.email || null;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.city !== undefined) updateData.city = data.city;
  if (data.photo_url !== undefined) updateData.photo_url = data.photo_url || null;
  if (data.organization_id !== undefined) updateData.organization_id = data.organization_id || null;
  if (data.tablet_ref !== undefined) updateData.tablet_ref = data.tablet_ref || null;
  if (data.clothing_size_top !== undefined)
    updateData.clothing_size_top = data.clothing_size_top || null;
  if (data.clothing_size_bottom !== undefined)
    updateData.clothing_size_bottom = data.clothing_size_bottom || null;

  let query = supabase.from("technicians").update(updateData).eq("id", id);

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data: technician, error } = await query.select().single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Un technicien avec cet email existe déjà");
    }
    throw new Error(`Erreur lors de la mise à jour du technicien: ${error.message}`);
  }

  return technician;
}

/**
 * Archive un technicien (soft-delete)
 */
export async function archiveTechnician(id: string, organizationId?: string): Promise<void> {
  const supabase = createClient();

  let query = supabase
    .from("technicians")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { error } = await query;

  if (error) {
    throw new Error(`Erreur lors de l'archivage du technicien: ${error.message}`);
  }
}

/**
 * Récupère l'historique des restocks d'un technicien (table technician_inventory_history)
 */
export async function getTechnicianInventoryHistory(
  technicianId: string
): Promise<TechnicianInventoryHistoryEntry[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("technician_inventory_history")
    .select("*")
    .eq("technician_id", technicianId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erreur lors de la récupération de l'historique: ${error.message}`);
  }

  return (data as unknown as TechnicianInventoryHistoryEntry[]) || [];
}

export interface TechnicianStockMovement {
  id: string;
  product_id: string;
  quantity: number;
  movement_type: "exit_technician";
  created_at: string;
  product: {
    id: string;
    name: string;
    sku: string | null;
    image_url: string | null;
  } | null;
}

/**
 * Récupère les mouvements de stock liés à un technicien (sorties vers ce technicien)
 */
export async function getTechnicianStockMovements(
  technicianId: string
): Promise<TechnicianStockMovement[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("stock_movements")
    .select(
      `
      id,
      product_id,
      quantity,
      movement_type,
      created_at,
      product:products(id, name, sku, image_url)
    `
    )
    .eq("technician_id", technicianId)
    .eq("movement_type", "exit_technician")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erreur lors de la récupération des mouvements: ${error.message}`);
  }

  // Transform the data to handle Supabase's array return for relations
  return (data || []).map((item) => ({
    ...item,
    product: Array.isArray(item.product) ? item.product[0] : item.product,
  })) as TechnicianStockMovement[];
}

export interface TechnicianYearlyProductTotal {
  product_id: string;
  product_name: string;
  product_sku: string | null;
  product_image_url: string | null;
  total_quantity: number;
}

/**
 * Récupère le cumul annuel des sorties par produit pour un technicien
 */
export async function getTechnicianYearlyTotals(
  technicianId: string,
  year: number
): Promise<TechnicianYearlyProductTotal[]> {
  const supabase = createClient();

  const yearStart = new Date(year, 0, 1).toISOString();
  const yearEnd = new Date(year + 1, 0, 1).toISOString();

  const { data, error } = await supabase
    .from("stock_movements")
    .select(
      `
      product_id,
      quantity,
      product:products(id, name, sku, image_url)
    `
    )
    .eq("technician_id", technicianId)
    .eq("movement_type", "exit_technician")
    .gte("created_at", yearStart)
    .lt("created_at", yearEnd);

  if (error) {
    throw new Error(`Erreur lors de la récupération des totaux annuels: ${error.message}`);
  }

  // Aggregate by product
  const map = new Map<string, TechnicianYearlyProductTotal>();
  for (const item of data || []) {
    const product = Array.isArray(item.product) ? item.product[0] : item.product;
    const pid = item.product_id;
    const existing = map.get(pid);
    if (existing) {
      existing.total_quantity += item.quantity;
    } else {
      map.set(pid, {
        product_id: pid,
        product_name: product?.name || "Produit supprimé",
        product_sku: product?.sku || null,
        product_image_url: product?.image_url || null,
        total_quantity: item.quantity,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total_quantity - a.total_quantity);
}

export interface TechnicianEvolutionMovement {
  id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  product: {
    id: string;
    name: string;
    sku: string | null;
  } | null;
}

/**
 * Récupère les mouvements exit_technician des N derniers mois pour un technicien,
 * avec join produit (id, name, sku). Utilisé pour le graphique d'évolution.
 */
export async function getTechnicianEvolutionData(
  technicianId: string,
  months: number = 3
): Promise<TechnicianEvolutionMovement[]> {
  const supabase = createClient();

  const sinceDate = new Date();
  sinceDate.setMonth(sinceDate.getMonth() - months);

  const { data, error } = await supabase
    .from("stock_movements")
    .select(
      `
      id,
      product_id,
      quantity,
      created_at,
      product:products(id, name, sku)
    `
    )
    .eq("technician_id", technicianId)
    .eq("movement_type", "exit_technician")
    .gte("created_at", sinceDate.toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Erreur lors de la récupération de l'évolution: ${error.message}`);
  }

  return (data || []).map((item) => ({
    ...item,
    product: Array.isArray(item.product) ? item.product[0] : item.product,
  })) as TechnicianEvolutionMovement[];
}

/**
 * Upload une photo de technicien dans le bucket technician-photos
 */
export async function uploadTechnicianPhoto(file: File, technicianId: string): Promise<string> {
  const supabase = createClient();

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${technicianId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("technician-photos")
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (uploadError) {
    throw new Error(`Erreur lors de l'upload: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage.from("technician-photos").getPublicUrl(path);

  return urlData.publicUrl;
}

/**
 * Supprime une photo de technicien du bucket
 */
export async function deleteTechnicianPhoto(photoUrl: string): Promise<void> {
  const supabase = createClient();

  const parts = photoUrl.split("/technician-photos/");
  if (parts.length < 2) return;

  const filePath = parts[1];
  await supabase.storage.from("technician-photos").remove([filePath]);
}
