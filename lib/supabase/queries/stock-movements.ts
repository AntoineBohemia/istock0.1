import { createClient } from "@/lib/supabase/client";

// Active types used in UI — exit_loss is deprecated but kept in DB enum for historical data
export type MovementType =
  | "entry"
  | "exit_technician"
  | "exit_anonymous"
  | "exit_loss"
  | "assign_equipment"
  | "unassign_equipment";

export interface StockMovement {
  id: string;
  product_id: string;
  quantity: number;
  movement_type: MovementType;
  technician_id: string | null;
  supplier_id: string | null;
  organization_id: string | null;
  unit_price: number | null;
  invoice_reference?: string | null;
  /** Facture d'achat qui couvre ce mouvement (une facture → plusieurs achats) */
  invoice_id?: string | null;
  created_at: string | null;
  product?: {
    id: string;
    name: string;
    sku: string;
    image_url: string | null;
    supplier_id: string | null;
  };
  technician?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  supplier?: {
    id: string;
    name: string;
  } | null;
  organization?: {
    id: string;
    name: string;
  } | null;
}

export interface StockMovementFilters {
  organizationId?: string;
  productId?: string;
  technicianId?: string;
  movementType?: MovementType;
  startDate?: string;
  endDate?: string;
}

export interface StockMovementsResult {
  movements: StockMovement[];
  total: number;
}

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  entry: "Entrée",
  exit_technician: "Sortie technicien",
  exit_anonymous: "Erreur stock",
  exit_loss: "Erreur stock",
  assign_equipment: "Assignation outil",
  unassign_equipment: "Retour outil",
};

export const MOVEMENT_TYPE_COLORS: Record<MovementType, string> = {
  entry: "success",
  exit_technician: "info",
  exit_anonymous: "secondary",
  exit_loss: "secondary",
  assign_equipment: "info",
  unassign_equipment: "success",
};

/**
 * Récupère la liste des mouvements de stock avec filtres et pagination
 */
export async function getStockMovements(
  filters: StockMovementFilters = {}
): Promise<StockMovementsResult> {
  const supabase = createClient();
  const { organizationId, productId, technicianId, movementType, startDate, endDate } = filters;

  let query = supabase.from("stock_movements").select(
    `
      *,
      product:products(id, name, sku, image_url, supplier_id),
      technician:technicians(id, first_name, last_name),
      supplier:suppliers(id, name),
      organization:organizations(id, name)
    `
  );

  // Filtrer par organisation
  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  // Appliquer les filtres
  if (productId) {
    query = query.eq("product_id", productId);
  }

  if (technicianId) {
    query = query.eq("technician_id", technicianId);
  }

  if (movementType) {
    query = query.eq("movement_type", movementType);
  }

  if (startDate) {
    query = query.gte("created_at", startDate);
  }

  if (endDate) {
    query = query.lte("created_at", endDate);
  }

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erreur lors de la récupération des mouvements: ${error.message}`);
  }

  const movements = (data as StockMovement[]) || [];

  return {
    movements,
    total: movements.length,
  };
}

/**
 * Récupère l'historique des mouvements d'un produit spécifique
 */
export async function getProductMovements(
  productId: string,
  limit: number = 50
): Promise<StockMovement[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("stock_movements")
    .select(
      `
      *,
      technician:technicians(id, first_name, last_name),
      organization:organizations(id, name),
      supplier:suppliers(id, name)
    `
    )
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Erreur lors de la récupération des mouvements: ${error.message}`);
  }

  return data || [];
}

/**
 * Entrées d'achat d'un produit sur une année, avec fournisseur et facture.
 * Utilisé par la page Achats pour détailler et retrouver les factures.
 */
export async function getProductEntries(productId: string, year: number): Promise<StockMovement[]> {
  const supabase = createClient();

  const startOfYear = new Date(year, 0, 1).toISOString();
  const endOfYear = new Date(year + 1, 0, 1).toISOString();

  const { data, error } = await supabase
    .from("stock_movements")
    .select(
      `
      *,
      organization:organizations(id, name),
      supplier:suppliers(id, name)
    `
    )
    .eq("product_id", productId)
    .eq("movement_type", "entry")
    .gte("created_at", startOfYear)
    .lt("created_at", endOfYear)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erreur lors de la récupération des achats: ${error.message}`);
  }

  return (data || []) as unknown as StockMovement[];
}

/**
 * Rattache un achat (mouvement d'entrée) à une facture existante.
 */
export async function linkMovementToInvoice(
  movementId: string,
  invoiceId: string | null
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("stock_movements")
    .update({ invoice_id: invoiceId })
    .eq("id", movementId);

  if (error) {
    throw new Error(`Erreur lors du rattachement à la facture: ${error.message}`);
  }
}

/**
 * Crée une entrée de stock (augmente stock_current)
 * Utilise une RPC atomique pour éviter les race conditions
 */
export async function createEntry(
  organizationId: string,
  productId: string,
  quantity: number,
  supplierId?: string,
  unitPrice?: number,
  invoiceReference?: string,
  entryDate?: string
): Promise<StockMovement> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("create_stock_entry", {
    p_organization_id: organizationId,
    p_product_id: productId,
    p_quantity: quantity,
    p_supplier_id: supplierId || undefined,
    p_unit_price: unitPrice || undefined,
    p_invoice_reference: invoiceReference || undefined,
    p_created_at: entryDate || undefined,
  });

  if (error) {
    throw new Error(`Erreur lors de la création du mouvement: ${error.message}`);
  }

  return data as unknown as StockMovement;
}

/**
 * Crée une sortie de stock (diminue stock_current)
 * Utilise une RPC atomique pour éviter les race conditions (TOCTOU)
 */
export async function createExit(
  organizationId: string,
  productId: string,
  quantity: number,
  type: "exit_technician" | "exit_anonymous" | "exit_loss",
  technicianId?: string
): Promise<StockMovement> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("create_stock_exit", {
    p_organization_id: organizationId,
    p_product_id: productId,
    p_quantity: quantity,
    p_type: type,
    p_technician_id: technicianId || undefined,
  });

  if (error) {
    throw new Error(`Erreur lors de la création du mouvement: ${error.message}`);
  }

  return data as unknown as StockMovement;
}

/**
 * Récupère les statistiques de mouvements pour un produit sur une période
 * Utile pour les graphiques d'évolution
 */
export async function getProductMovementStats(
  productId: string,
  months: number = 3
): Promise<
  Array<{
    date: string;
    entries: number;
    exits: number;
    balance: number;
  }>
> {
  const supabase = createClient();

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const { data, error } = await supabase
    .from("stock_movements")
    .select("quantity, movement_type, created_at")
    .eq("product_id", productId)
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Erreur lors de la récupération des statistiques: ${error.message}`);
  }

  // Grouper par jour
  const dailyStats: Record<string, { entries: number; exits: number }> = {};

  data?.forEach((movement) => {
    const date = new Date(movement.created_at!).toISOString().split("T")[0];

    if (!dailyStats[date]) {
      dailyStats[date] = { entries: 0, exits: 0 };
    }

    if (movement.movement_type === "entry") {
      dailyStats[date].entries += movement.quantity;
    } else {
      dailyStats[date].exits += movement.quantity;
    }
  });

  // Convertir en tableau trié
  return Object.entries(dailyStats)
    .map(([date, stats]) => ({
      date,
      entries: stats.entries,
      exits: stats.exits,
      balance: stats.entries - stats.exits,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Récupère les valeurs totales d'entrée par organisation pour une année donnée
 * Note : utilise le prix actuel du produit (pas de prix historique stocké dans stock_movements)
 */
export async function getYearlyEntryValuesByOrg(year?: number): Promise<{
  byOrg: Record<string, number>;
  cumul: number;
  globalStockValue: number;
}> {
  const supabase = createClient();
  const targetYear = year ?? new Date().getFullYear();
  const startOfYear = new Date(targetYear, 0, 1).toISOString();
  const endOfYear = new Date(targetYear + 1, 0, 1).toISOString();

  // 1. Entry values by org (join with products for price)
  const { data: entries, error: entriesError } = await supabase
    .from("stock_movements")
    .select("quantity, organization_id, product:products(price)")
    .eq("movement_type", "entry")
    .gte("created_at", startOfYear)
    .lt("created_at", endOfYear);

  if (entriesError) {
    throw new Error(`Erreur récupération entrées: ${entriesError.message}`);
  }

  const byOrg: Record<string, number> = {};
  let cumul = 0;

  entries?.forEach((m) => {
    const price = (m.product as unknown as { price: number | null })?.price ?? 0;
    const value = m.quantity * price;
    const orgId = m.organization_id ?? "unknown";
    byOrg[orgId] = (byOrg[orgId] ?? 0) + value;
    cumul += value;
  });

  // 2. Global stock value (all orgs, current stock × current price)
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("stock_current, price")
    .is("archived_at", null);

  if (productsError) {
    throw new Error(`Erreur récupération stock global: ${productsError.message}`);
  }

  const globalStockValue = (products ?? []).reduce(
    (sum, p) => sum + (p.price ?? 0) * (p.stock_current ?? 0),
    0
  );

  return { byOrg, cumul, globalStockValue };
}

/**
 * Récupère un résumé des mouvements récents
 */
export async function getMovementsSummary(organizationId?: string): Promise<{
  totalEntries: number;
  totalExits: number;
  recentMovements: number;
}> {
  const supabase = createClient();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let query = supabase
    .from("stock_movements")
    .select("quantity, movement_type")
    .gte("created_at", thirtyDaysAgo.toISOString());

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erreur lors de la récupération du résumé: ${error.message}`);
  }

  let totalEntries = 0;
  let totalExits = 0;

  data?.forEach((movement) => {
    if (movement.movement_type === "entry") {
      totalEntries += movement.quantity;
    } else {
      totalExits += movement.quantity;
    }
  });

  return {
    totalEntries,
    totalExits,
    recentMovements: data?.length || 0,
  };
}

/** Entry detail per org, optionally broken down by unit_price and supplier */
export interface OrgEntryDetail {
  qty: number;
  byPrice: { unitPrice: number; qty: number }[];
  suppliers: { name: string; qty: number }[];
}

/**
 * Agrège les quantités d'entrées par produit et par organisation pour une année civile.
 * Inclut le détail par prix unitaire pour chaque org.
 */
export async function getYearlyEntryQtyByProduct(
  year?: number
): Promise<Record<string, Record<string, OrgEntryDetail>>> {
  const supabase = createClient();
  const targetYear = year ?? new Date().getFullYear();
  const startOfYear = new Date(targetYear, 0, 1).toISOString();
  const endOfYear = new Date(targetYear + 1, 0, 1).toISOString();

  const { data, error } = await supabase
    .from("stock_movements")
    .select("product_id, organization_id, quantity, unit_price, supplier:suppliers(name)")
    .eq("movement_type", "entry")
    .gte("created_at", startOfYear)
    .lt("created_at", endOfYear);

  if (error) {
    throw new Error(`Erreur récupération entrées par produit: ${error.message}`);
  }

  const result: Record<string, Record<string, OrgEntryDetail>> = {};

  data?.forEach((m) => {
    const pid = m.product_id;
    const oid = m.organization_id ?? "unknown";
    const price = m.unit_price ?? 0;

    if (!result[pid]) result[pid] = {};
    if (!result[pid][oid]) result[pid][oid] = { qty: 0, byPrice: [], suppliers: [] };

    result[pid][oid].qty += m.quantity;

    const existing = result[pid][oid].byPrice.find((bp) => bp.unitPrice === price);
    if (existing) {
      existing.qty += m.quantity;
    } else {
      result[pid][oid].byPrice.push({ unitPrice: price, qty: m.quantity });
    }

    // Fournisseur de l'entrée (jointure many-to-one : objet ou tableau selon l'inférence)
    const supRel = m.supplier as { name: string | null } | { name: string | null }[] | null;
    const supplierName = Array.isArray(supRel) ? supRel[0]?.name : supRel?.name;
    if (supplierName) {
      const existingSup = result[pid][oid].suppliers.find((s) => s.name === supplierName);
      if (existingSup) {
        existingSup.qty += m.quantity;
      } else {
        result[pid][oid].suppliers.push({ name: supplierName, qty: m.quantity });
      }
    }
  });

  // Tri : prix décroissant, fournisseurs par quantité décroissante
  Object.values(result).forEach((orgs) =>
    Object.values(orgs).forEach((detail) => {
      detail.byPrice.sort((a, b) => b.unitPrice - a.unitPrice);
      detail.suppliers.sort((a, b) => b.qty - a.qty);
    })
  );

  return result;
}

/**
 * Récupère l'historique des prix d'un produit
 */
export interface PriceHistoryEntry {
  id: string;
  price: number;
  effective_from: string;
}

export async function getProductPriceHistory(productId: string): Promise<PriceHistoryEntry[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("product_price_history")
    .select("id, price, effective_from")
    .eq("product_id", productId)
    .order("effective_from", { ascending: false });

  if (error) {
    throw new Error(`Erreur récupération historique prix: ${error.message}`);
  }

  return data ?? [];
}
