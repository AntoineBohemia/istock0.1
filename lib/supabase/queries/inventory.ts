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
export async function getAvailableProductsForRestock(): Promise<
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
 * Étapes :
 * 1. Lire l'inventaire actuel
 * 2. Sauvegarder un snapshot dans technician_inventory_history
 * 3. Pour chaque item : vérifier stock, upsert inventaire, créer mouvement, décrémenter stock
 */
export async function addToTechnicianInventory(
  technicianId: string,
  items: RestockItem[]
): Promise<RestockResult> {
  const supabase = createClient();

  // 1. Lire l'inventaire actuel du technicien
  const { data: currentInventory, error: invError } = await supabase
    .from("technician_inventory")
    .select("id, product_id, quantity, product:products(name, sku)")
    .eq("technician_id", technicianId);

  if (invError) {
    throw new Error(`Erreur lors de la lecture de l'inventaire: ${invError.message}`);
  }

  const previousItemsCount = currentInventory?.length ?? 0;

  // 2. Sauvegarder un snapshot dans l'historique
  const snapshotItems = (currentInventory ?? []).map((inv: any) => ({
    product_id: inv.product_id,
    product_name: inv.product?.name ?? "",
    product_sku: inv.product?.sku ?? null,
    quantity: inv.quantity,
  }));

  const { error: historyError } = await supabase
    .from("technician_inventory_history")
    .insert({
      technician_id: technicianId,
      snapshot: {
        items: snapshotItems,
        total_items: snapshotItems.reduce((sum: number, i: any) => sum + i.quantity, 0),
      },
    });

  if (historyError) {
    throw new Error(`Erreur lors de la sauvegarde de l'historique: ${historyError.message}`);
  }

  // 3. Traiter chaque item
  for (const item of items) {
    // a. Vérifier le stock disponible
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("stock_current, name")
      .eq("id", item.productId)
      .single();

    if (productError || !product) {
      throw new Error("Produit non trouvé");
    }

    if (product.stock_current < item.quantity) {
      throw new Error(
        `Stock insuffisant pour "${product.name}". Disponible: ${product.stock_current}, demandé: ${item.quantity}`
      );
    }

    // b. Vérifier si le technicien a déjà ce produit
    const existing = (currentInventory ?? []).find(
      (inv: any) => inv.product_id === item.productId
    );

    if (existing) {
      // UPDATE quantity += new_quantity
      const { error: updateError } = await supabase
        .from("technician_inventory")
        .update({ quantity: existing.quantity + item.quantity })
        .eq("id", existing.id);

      if (updateError) {
        throw new Error(`Erreur lors de la mise à jour de l'inventaire: ${updateError.message}`);
      }
    } else {
      // INSERT nouveau produit dans l'inventaire
      const { error: insertError } = await supabase
        .from("technician_inventory")
        .insert({
          technician_id: technicianId,
          product_id: item.productId,
          quantity: item.quantity,
        });

      if (insertError) {
        throw new Error(`Erreur lors de l'ajout à l'inventaire: ${insertError.message}`);
      }
    }

    // c. Créer le mouvement de stock
    const { error: movementError } = await supabase
      .from("stock_movements")
      .insert({
        product_id: item.productId,
        quantity: item.quantity,
        movement_type: "exit_technician",
        technician_id: technicianId,
      });

    if (movementError) {
      throw new Error(`Erreur lors de la création du mouvement: ${movementError.message}`);
    }

    // d. Décrémenter le stock du produit
    const { error: stockError } = await supabase
      .from("products")
      .update({
        stock_current: product.stock_current - item.quantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.productId);

    if (stockError) {
      throw new Error(`Erreur lors de la mise à jour du stock: ${stockError.message}`);
    }
  }

  return {
    success: true,
    items_count: items.length,
    previous_items_count: previousItemsCount,
  };
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
