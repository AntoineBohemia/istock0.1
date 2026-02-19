import { createClient } from "@/lib/supabase/client";

export interface Technician {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
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
    stock_max: number | null;
  };
}

export interface TechnicianWithInventory extends Technician {
  inventory: TechnicianInventoryItem[];
  inventory_count: number;
  last_restock_at: string | null;
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
  email: string;
  phone?: string | null;
  city?: string | null;
}

export interface UpdateTechnicianData extends Partial<CreateTechnicianData> {}

/**
 * Récupère la liste des techniciens avec leur nombre d'items en inventaire
 * Utilise une RPC pour tout faire en une seule requête SQL (JOIN + aggregation)
 */
export async function getTechnicians(organizationId?: string): Promise<TechnicianWithInventory[]> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_technicians_with_stats", {
    p_organization_id: organizationId,
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
    .select(`
      *,
      product:products(id, name, sku, image_url, stock_max)
    `)
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

  const inventoryCount = inventory?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return {
    ...technician,
    inventory: inventory || [],
    inventory_count: inventoryCount,
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
      email: data.email,
      phone: data.phone || null,
      city: data.city || null,
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
  data: UpdateTechnicianData
): Promise<Technician> {
  const supabase = createClient();

  const updateData: Record<string, unknown> = {};

  if (data.first_name !== undefined) updateData.first_name = data.first_name;
  if (data.last_name !== undefined) updateData.last_name = data.last_name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.city !== undefined) updateData.city = data.city;

  const { data: technician, error } = await supabase
    .from("technicians")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Un technicien avec cet email existe déjà");
    }
    throw new Error(`Erreur lors de la mise à jour du technicien: ${error.message}`);
  }

  return technician;
}

/**
 * Supprime un technicien (et son inventaire par cascade)
 */
export async function deleteTechnician(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("technicians").delete().eq("id", id);

  if (error) {
    throw new Error(`Erreur lors de la suppression du technicien: ${error.message}`);
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
  notes: string | null;
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
    .select(`
      id,
      product_id,
      quantity,
      movement_type,
      notes,
      created_at,
      product:products(id, name, sku, image_url)
    `)
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

export interface TechniciansStats {
  totalTechnicians: number;
  emptyInventory: number;
  totalItems: number;
  recentRestocks: number;
}

/**
 * Récupère les statistiques des techniciens
 */
export async function getTechniciansStats(organizationId: string): Promise<TechniciansStats> {
  const supabase = createClient();

  // Récupérer tous les techniciens
  const { data: technicians, error: techError } = await supabase
    .from("technicians")
    .select("id")
    .eq("organization_id", organizationId);

  if (techError) {
    throw new Error(`Erreur lors de la récupération des techniciens: ${techError.message}`);
  }

  const technicianIds = technicians?.map((t) => t.id) || [];
  const totalTechnicians = technicianIds.length;

  if (totalTechnicians === 0) {
    return {
      totalTechnicians: 0,
      emptyInventory: 0,
      totalItems: 0,
      recentRestocks: 0,
    };
  }

  // Récupérer l'inventaire pour calculer les items totaux et inventaires vides
  const { data: inventoryData, error: invError } = await supabase
    .from("technician_inventory")
    .select("technician_id, quantity")
    .in("technician_id", technicianIds);

  if (invError) {
    throw new Error(`Erreur lors de la récupération de l'inventaire: ${invError.message}`);
  }

  // Calculer les items par technicien
  const inventoryByTechnician: Record<string, number> = {};
  let totalItems = 0;
  inventoryData?.forEach((item) => {
    if (!inventoryByTechnician[item.technician_id]) {
      inventoryByTechnician[item.technician_id] = 0;
    }
    inventoryByTechnician[item.technician_id] += item.quantity;
    totalItems += item.quantity;
  });

  // Techniciens avec inventaire vide
  const emptyInventory = technicianIds.filter(
    (id) => !inventoryByTechnician[id] || inventoryByTechnician[id] === 0
  ).length;

  // Restocks récents (7 derniers jours)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: recentRestocksData, error: restockError } = await supabase
    .from("stock_movements")
    .select("technician_id")
    .eq("movement_type", "exit_technician")
    .in("technician_id", technicianIds)
    .gte("created_at", sevenDaysAgo.toISOString());

  if (restockError) {
    throw new Error(`Erreur lors de la récupération des restocks: ${restockError.message}`);
  }

  // Compter les techniciens uniques restockés
  const uniqueRestockedTechnicians = new Set(
    recentRestocksData?.map((r) => r.technician_id) || []
  );

  return {
    totalTechnicians,
    emptyInventory,
    totalItems,
    recentRestocks: uniqueRestockedTechnicians.size,
  };
}
