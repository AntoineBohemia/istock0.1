import { createClient } from "@/lib/supabase/client";

export type MovementType = "entry" | "exit_technician" | "exit_anonymous" | "exit_loss";

export interface StockMovement {
  id: string;
  product_id: string;
  quantity: number;
  movement_type: MovementType;
  technician_id: string | null;
  notes: string | null;
  organization_id: string | null;
  created_at: string | null;
  product?: {
    id: string;
    name: string;
    sku: string;
    image_url: string | null;
  };
  technician?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

export interface StockMovementFilters {
  organizationId?: string;
  productId?: string;
  technicianId?: string;
  movementType?: MovementType;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface StockMovementsResult {
  movements: StockMovement[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  entry: "Entrée",
  exit_technician: "Sortie technicien",
  exit_anonymous: "Sortie anonyme",
  exit_loss: "Perte/Casse",
};

export const MOVEMENT_TYPE_COLORS: Record<MovementType, string> = {
  entry: "success",
  exit_technician: "info",
  exit_anonymous: "secondary",
  exit_loss: "destructive",
};

/**
 * Récupère la liste des mouvements de stock avec filtres et pagination
 */
export async function getStockMovements(
  filters: StockMovementFilters = {}
): Promise<StockMovementsResult> {
  const supabase = createClient();
  const {
    organizationId,
    productId,
    technicianId,
    movementType,
    startDate,
    endDate,
    page = 1,
    pageSize = 20,
  } = filters;

  let query = supabase
    .from("stock_movements")
    .select(
      `
      *,
      product:products(id, name, sku, image_url),
      technician:technicians(id, first_name, last_name)
    `,
      { count: "exact" }
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

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Erreur lors de la récupération des mouvements: ${error.message}`);
  }

  const total = count || 0;

  return {
    movements: (data as StockMovement[]) || [],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
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
      technician:technicians(id, first_name, last_name)
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
 * Crée une entrée de stock (augmente stock_current)
 * Utilise une RPC atomique pour éviter les race conditions
 */
export async function createEntry(
  organizationId: string,
  productId: string,
  quantity: number,
  notes?: string
): Promise<StockMovement> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("create_stock_entry", {
    p_organization_id: organizationId,
    p_product_id: productId,
    p_quantity: quantity,
    p_notes: notes || undefined,
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
  technicianId?: string,
  notes?: string
): Promise<StockMovement> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("create_stock_exit", {
    p_organization_id: organizationId,
    p_product_id: productId,
    p_quantity: quantity,
    p_type: type,
    p_technician_id: technicianId || undefined,
    p_notes: notes || undefined,
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
