import { createClient } from "@/lib/supabase/client";

export interface RestockItem {
  productId: string;
  quantity: number;
}

export interface RestockResult {
  success: boolean;
  items_count: number;
  previous_items_count: number;
}

/**
 * Restock un technicien avec de nouveaux items.
 * Cette opération est atomique et effectue les étapes suivantes:
 * 1. Sauvegarde l'inventaire actuel dans l'historique
 * 2. Supprime l'inventaire actuel
 * 3. Insère les nouveaux items
 * 4. Crée les mouvements de stock (exit_technician)
 * 5. Décrémente le stock des produits
 */
export async function restockTechnician(
  technicianId: string,
  items: RestockItem[]
): Promise<RestockResult> {
  const supabase = createClient();

  // Préparer les items au format attendu par la fonction PostgreSQL
  const itemsJson = items.map((item) => ({
    product_id: item.productId,
    quantity: item.quantity,
  }));

  const { data, error } = await supabase.rpc("restock_technician", {
    p_technician_id: technicianId,
    p_items: itemsJson,
  });

  if (error) {
    // Parser le message d'erreur pour les erreurs de stock insuffisant
    if (error.message.includes("Stock insuffisant")) {
      throw new Error("Stock insuffisant pour un ou plusieurs produits");
    }
    throw new Error(`Erreur lors du restock: ${error.message}`);
  }

  return data as RestockResult;
}

/**
 * Récupère les produits disponibles pour le restock (avec stock > 0)
 */
export async function getAvailableProductsForRestock(organizationId: string): Promise<
  Array<{
    id: string;
    name: string;
    sku: string | null;
    image_url: string | null;
    stock_current: number;
    stock_max: number;
  }>
> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("products")
    .select("id, name, sku, image_url, stock_current, stock_max")
    .eq("organization_id", organizationId)
    .gt("stock_current", 0)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Erreur lors de la récupération des produits: ${error.message}`);
  }

  return data || [];
}

/**
 * Ajoute des items à l'inventaire existant d'un technicien sans le réinitialiser.
 * Pour les produits déjà présents, les quantités sont additionnées.
 * Opération atomique via RPC PostgreSQL.
 */
export async function addToTechnicianInventory(
  technicianId: string,
  items: RestockItem[]
): Promise<RestockResult> {
  const supabase = createClient();

  const itemsJson = items.map((item) => ({
    product_id: item.productId,
    quantity: item.quantity,
  }));

  const { data, error } = await supabase.rpc("add_to_technician_inventory", {
    p_technician_id: technicianId,
    p_items: itemsJson,
  });

  if (error) {
    if (error.message.includes("Stock insuffisant")) {
      throw new Error("Stock insuffisant pour un ou plusieurs produits");
    }
    throw new Error(`Erreur lors de l'ajout à l'inventaire: ${error.message}`);
  }

  return data as RestockResult;
}

/**
 * Calcule le pourcentage d'inventaire d'un technicien par rapport au stock max
 */
export function calculateInventoryPercentage(
  quantity: number,
  stockMax: number
): number {
  if (stockMax <= 0) return 0;
  return Math.min(100, Math.round((quantity / stockMax) * 100));
}
