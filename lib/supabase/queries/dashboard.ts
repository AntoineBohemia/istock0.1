import { createClient } from "@/lib/supabase/client";
import { calculateStockScore } from "@/lib/utils/stock";
// Note: calculateStockScore is still used by getProductsNeedingRestock and getTechnicianStats below

export interface DashboardTask {
  type: string;
  priority: "critical" | "important" | "informational";
  score: number;
  group_key: string;
  entity_type: "product" | "technician";
  entity_ids: string[];
  entity_names: string[];
  count: number;
  summary: string;
  action_url: string;
  metadata: Record<string, unknown>;
}

export interface DashboardStats {
  totalStock: number;
  totalValue: number;
  monthlyEntries: number;
  monthlyExits: number;
  totalProducts: number;
  lowStockCount: number;
  prevMonthEntries?: number;
  prevMonthExits?: number;
  prevMonthStock?: number;
  prevMonthValue?: number;
}

export interface HealthScorePenalty {
  type: string;
  points: number;
  count: number;
  details: string;
}

export interface HealthScoreKPI {
  total_stock: number;
  total_value: number;
  entries_month: number;
  exits_month: number;
  entries_prev_month: number;
  exits_prev_month: number;
}

export interface HealthScoreTrend {
  previous_score: number | null;
  direction: "up" | "down" | "stable";
}

export interface HealthScore {
  score: number;
  label: string;
  color: "green" | "orange" | "red";
  penalties: HealthScorePenalty[];
  trend: HealthScoreTrend;
  kpi: HealthScoreKPI;
}

export interface HealthScoreHistoryMonth {
  month: string;
  score: number;
  penalties_total: number;
  product_zero_count: number;
  product_low_count: number;
  technician_never_count: number;
  technician_late_count: number;
}

export interface ProductNeedingRestock {
  id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  stock_current: number | null;
  stock_min: number | null;
  stock_max: number | null;
  score: number;
  last_movement_at: string | null;
}

export interface TechnicianDashboardRow {
  id: string;
  first_name: string;
  last_name: string;
  inventory_item_count: number;
  total_inventory_quantity: number;
  last_restock_at: string | null;
  days_since_restock: number;
  coverage_pct: number;
}

export interface TechnicianNeedingRestock {
  id: string;
  first_name: string;
  last_name: string;
  last_restock: string | null;
  days_since_restock: number;
  inventory_count: number;
}

export interface RecentMovement {
  id: string;
  quantity: number;
  movement_type: "entry" | "exit_technician" | "exit_anonymous" | "exit_loss";
  created_at: string | null;
  notes: string | null;
  product: {
    id: string;
    name: string;
    sku: string | null;
    image_url: string | null;
    price: number | null;
  };
  technician: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

export interface StockEvolutionData {
  date: string;
  totalStock: number;
  entries: number;
  exits: number;
}

/**
 * Récupère les statistiques générales du dashboard
 * Utilise une RPC pour tout calculer en une seule requête SQL
 */
export async function getDashboardStats(organizationId?: string): Promise<DashboardStats> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_dashboard_stats", {
    p_organization_id: organizationId,
  });

  if (error) {
    throw new Error(`Erreur lors de la récupération des statistiques: ${error.message}`);
  }

  return data as unknown as DashboardStats;
}

/**
 * Récupère le score de santé unifié (score + penalties + trend + KPIs)
 */
export async function getHealthScore(organizationId: string): Promise<HealthScore> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_health_score", {
    p_organization_id: organizationId,
  });

  if (error) {
    throw new Error(`Erreur lors de la récupération du score de santé: ${error.message}`);
  }

  return data as unknown as HealthScore;
}

/**
 * Récupère l'historique du score de santé sur les N derniers mois
 */
export async function getHealthScoreHistory(
  organizationId: string,
  months: number = 6
): Promise<HealthScoreHistoryMonth[]> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_health_score_history", {
    p_organization_id: organizationId,
    p_months: months,
  });

  if (error) {
    throw new Error(`Erreur lors de la récupération de l'historique du score: ${error.message}`);
  }

  return (data as unknown as HealthScoreHistoryMonth[]) || [];
}

/**
 * Récupère les tâches actionnables du dashboard via la RPC get_dashboard_tasks
 */
export async function getDashboardTasks(organizationId: string): Promise<DashboardTask[]> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_dashboard_tasks", {
    p_organization_id: organizationId,
  });

  if (error) {
    throw new Error(`Erreur lors de la récupération des tâches: ${error.message}`);
  }

  return (data as unknown as DashboardTask[]) || [];
}

/**
 * Récupère les produits nécessitant un réapprovisionnement (score < scoreThreshold)
 */
export async function getProductsNeedingRestock(
  limit: number = 10,
  organizationId?: string,
  scoreThreshold: number = 30
): Promise<ProductNeedingRestock[]> {
  const supabase = createClient();

  let query = supabase
    .from("products")
    .select("id, name, sku, image_url, stock_current, stock_min, stock_max")
    .is("archived_at", null)
    .order("stock_current", { ascending: true });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data: products, error } = await query;

  if (error) {
    throw new Error(`Erreur lors de la récupération des produits: ${error.message}`);
  }

  const productIds = products?.map((p) => p.id) || [];

  // Fetch last movement per product
  const lastMovementMap: Record<string, string> = {};
  if (productIds.length > 0) {
    const { data: movements } = await supabase
      .from("stock_movements")
      .select("product_id, created_at")
      .in("product_id", productIds)
      .order("created_at", { ascending: false });

    movements?.forEach((m) => {
      if (m.product_id && !lastMovementMap[m.product_id] && m.created_at) {
        lastMovementMap[m.product_id] = m.created_at;
      }
    });
  }

  // Filtrer et calculer le score
  const productsWithScore = products
    ?.map((product) => ({
      ...product,
      score: calculateStockScore(
        product.stock_current ?? 0,
        product.stock_min ?? 0,
        product.stock_max ?? 0
      ),
      last_movement_at: lastMovementMap[product.id] || null,
    }))
    .filter((product) => product.score < scoreThreshold)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);

  return productsWithScore || [];
}

/**
 * Récupère les techniciens dont le dernier restock date de plus de X jours
 */
export async function getTechniciansNeedingRestock(
  daysThreshold: number = 7,
  organizationId?: string
): Promise<TechnicianNeedingRestock[]> {
  const supabase = createClient();

  // Récupérer tous les techniciens avec leur inventaire (non archivés)
  let techniciansQuery = supabase
    .from("technicians")
    .select(`
      id,
      first_name,
      last_name,
      technician_inventory(id)
    `)
    .is("archived_at", null);

  if (organizationId) {
    techniciansQuery = techniciansQuery.eq("organization_id", organizationId);
  }

  const { data: technicians, error: techniciansError } = await techniciansQuery;

  if (techniciansError) {
    throw new Error(`Erreur lors de la récupération des techniciens: ${techniciansError.message}`);
  }

  const technicianIds = technicians?.map((t) => t.id) || [];

  // Si aucun technicien, pas besoin de requêter l'historique
  if (technicianIds.length === 0) {
    return [];
  }

  // Récupérer le dernier restock de chaque technicien via l'historique
  // Filtré par technician_id pour éviter toute fuite de données cross-tenant
  const { data: historyEntries, error: historyError } = await supabase
    .from("technician_inventory_history")
    .select("technician_id, created_at")
    .in("technician_id", technicianIds)
    .order("created_at", { ascending: false });

  if (historyError) {
    throw new Error(`Erreur lors de la récupération de l'historique: ${historyError.message}`);
  }

  // Grouper par technicien (prendre le plus récent)
  const lastRestockByTechnician: Record<string, string> = {};
  historyEntries?.forEach((entry) => {
    if (!lastRestockByTechnician[entry.technician_id] && entry.created_at) {
      lastRestockByTechnician[entry.technician_id] = entry.created_at;
    }
  });

  const now = new Date();
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

  const techniciansNeedingRestock: TechnicianNeedingRestock[] = [];

  technicians?.forEach((tech) => {
    const lastRestock = lastRestockByTechnician[tech.id];
    let daysSinceRestock = daysThreshold + 1; // Par défaut, considérer comme devant être restocké

    if (lastRestock) {
      const lastRestockDate = new Date(lastRestock);
      daysSinceRestock = Math.floor(
        (now.getTime() - lastRestockDate.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    // Inclure si pas de restock ou si dernier restock > seuil
    if (!lastRestock || daysSinceRestock > daysThreshold) {
      techniciansNeedingRestock.push({
        id: tech.id,
        first_name: tech.first_name,
        last_name: tech.last_name,
        last_restock: lastRestock || null,
        days_since_restock: daysSinceRestock,
        inventory_count: Array.isArray(tech.technician_inventory)
          ? tech.technician_inventory.length
          : 0,
      });
    }
  });

  // Trier par jours depuis le dernier restock (décroissant)
  return techniciansNeedingRestock.sort(
    (a, b) => b.days_since_restock - a.days_since_restock
  );
}

/**
 * Récupère les mouvements récents
 */
export async function getRecentMovements(
  limit: number = 10,
  organizationId?: string
): Promise<RecentMovement[]> {
  const supabase = createClient();

  let query = supabase
    .from("stock_movements")
    .select(`
      id,
      quantity,
      movement_type,
      created_at,
      notes,
      product:products(id, name, sku, image_url, price),
      technician:technicians(id, first_name, last_name)
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erreur lors de la récupération des mouvements: ${error.message}`);
  }

  // Transform data to match RecentMovement type
  // Supabase may return arrays for relations depending on query structure
  return (data || []).map((item) => {
    const productData = Array.isArray(item.product) ? item.product[0] : item.product;
    const technicianData = Array.isArray(item.technician) ? item.technician[0] : item.technician;

    return {
      id: item.id,
      quantity: item.quantity,
      movement_type: item.movement_type as RecentMovement["movement_type"],
      created_at: item.created_at,
      notes: item.notes,
      product: productData as RecentMovement["product"],
      technician: technicianData as RecentMovement["technician"],
    };
  });
}

/**
 * Récupère tous les techniciens pour le dashboard avec stats d'inventaire
 */
export async function getAllTechniciansForDashboard(
  organizationId: string
): Promise<TechnicianDashboardRow[]> {
  const supabase = createClient();

  // Fetch all non-archived technicians with their inventory
  const { data: technicians, error: techError } = await supabase
    .from("technicians")
    .select(`
      id,
      first_name,
      last_name,
      technician_inventory(id, quantity, product:products(stock_max))
    `)
    .eq("organization_id", organizationId)
    .is("archived_at", null);

  if (techError) {
    throw new Error(`Erreur lors de la récupération des techniciens: ${techError.message}`);
  }

  if (!technicians || technicians.length === 0) return [];

  const technicianIds = technicians.map((t) => t.id);

  // Fetch last restock per technician
  const { data: historyEntries } = await supabase
    .from("technician_inventory_history")
    .select("technician_id, created_at")
    .in("technician_id", technicianIds)
    .order("created_at", { ascending: false });

  const lastRestockMap: Record<string, string> = {};
  historyEntries?.forEach((entry) => {
    if (!lastRestockMap[entry.technician_id] && entry.created_at) {
      lastRestockMap[entry.technician_id] = entry.created_at;
    }
  });

  const now = new Date();

  return technicians.map((tech) => {
    const inventory = Array.isArray(tech.technician_inventory) ? tech.technician_inventory : [];
    const itemCount = inventory.length;
    const totalQuantity = inventory.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);

    // Coverage: average of (quantity / stock_max) across items
    let coveragePct = 0;
    if (itemCount > 0) {
      const totalCoverage = inventory.reduce((sum: number, item: any) => {
        const max = item.product?.stock_max || 100;
        return sum + Math.min(100, Math.round((item.quantity / max) * 100));
      }, 0);
      coveragePct = Math.round(totalCoverage / itemCount);
    }

    const lastRestock = lastRestockMap[tech.id] || null;
    let daysSinceRestock = -1;
    if (lastRestock) {
      daysSinceRestock = Math.floor(
        (now.getTime() - new Date(lastRestock).getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    return {
      id: tech.id,
      first_name: tech.first_name,
      last_name: tech.last_name,
      inventory_item_count: itemCount,
      total_inventory_quantity: totalQuantity,
      last_restock_at: lastRestock,
      days_since_restock: daysSinceRestock,
      coverage_pct: coveragePct,
    };
  }).sort((a, b) => {
    // Never restocked first (days = -1), then by most days since restock
    if (a.days_since_restock === -1 && b.days_since_restock !== -1) return -1;
    if (b.days_since_restock === -1 && a.days_since_restock !== -1) return 1;
    if (a.days_since_restock === -1 && b.days_since_restock === -1) return 0;
    return b.days_since_restock - a.days_since_restock;
  });
}

/**
 * Récupère l'évolution globale du stock sur une période
 */
export async function getGlobalStockEvolution(
  months: number = 6,
  organizationId?: string
): Promise<StockEvolutionData[]> {
  const supabase = createClient();

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  // Récupérer tous les mouvements sur la période
  let movementsQuery = supabase
    .from("stock_movements")
    .select("quantity, movement_type, created_at")
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: true });

  if (organizationId) {
    movementsQuery = movementsQuery.eq("organization_id", organizationId);
  }

  const { data: movements, error } = await movementsQuery;

  if (error) {
    throw new Error(`Erreur lors de la récupération des mouvements: ${error.message}`);
  }

  // Récupérer le stock actuel total (non archivés)
  let productsQuery = supabase
    .from("products")
    .select("stock_current")
    .is("archived_at", null);

  if (organizationId) {
    productsQuery = productsQuery.eq("organization_id", organizationId);
  }

  const { data: products } = await productsQuery;

  const currentTotalStock =
    products?.reduce((sum, p) => sum + (p.stock_current || 0), 0) || 0;

  // Grouper les mouvements par mois
  const monthlyData: Record<string, { entries: number; exits: number }> = {};

  movements?.forEach((movement) => {
    if (!movement.created_at) return;
    const date = new Date(movement.created_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { entries: 0, exits: 0 };
    }

    if (movement.movement_type === "entry") {
      monthlyData[monthKey].entries += movement.quantity;
    } else {
      monthlyData[monthKey].exits += movement.quantity;
    }
  });

  // Générer tous les mois de la période
  const result: StockEvolutionData[] = [];
  const currentDate = new Date();
  let runningStock = currentTotalStock;

  // Calculer le stock en remontant dans le temps
  const sortedMonths = Object.keys(monthlyData).sort().reverse();
  const stockByMonth: Record<string, number> = {};

  // Le mois courant a le stock actuel
  const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
  stockByMonth[currentMonthKey] = currentTotalStock;

  // Remonter dans le temps pour calculer les stocks passés
  for (let i = 0; i < months; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (i === 0) {
      stockByMonth[monthKey] = currentTotalStock;
    } else {
      const prevMonthDate = new Date();
      prevMonthDate.setMonth(prevMonthDate.getMonth() - i + 1);
      const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;

      const prevMonthData = monthlyData[prevMonthKey] || { entries: 0, exits: 0 };
      const prevStock = stockByMonth[prevMonthKey] || currentTotalStock;

      // Stock du mois = stock du mois suivant - entrées du mois suivant + sorties du mois suivant
      stockByMonth[monthKey] = prevStock - prevMonthData.entries + prevMonthData.exits;
    }
  }

  // Construire le résultat dans l'ordre chronologique
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthData = monthlyData[monthKey] || { entries: 0, exits: 0 };

    result.push({
      date: monthKey,
      totalStock: stockByMonth[monthKey] || 0,
      entries: monthData.entries,
      exits: monthData.exits,
    });
  }

  return result;
}

/**
 * Récupère l'évolution du stock d'un produit spécifique sur une période
 */
export async function getProductStockEvolution(
  productId: string,
  months: number = 6
): Promise<StockEvolutionData[]> {
  const supabase = createClient();

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  // Récupérer le stock actuel du produit
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("stock_current")
    .eq("id", productId)
    .single();

  if (productError) {
    throw new Error(`Erreur lors de la récupération du produit: ${productError.message}`);
  }

  const currentStock = product?.stock_current || 0;

  // Récupérer tous les mouvements du produit sur la période
  const { data: movements, error } = await supabase
    .from("stock_movements")
    .select("quantity, movement_type, created_at")
    .eq("product_id", productId)
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Erreur lors de la récupération des mouvements: ${error.message}`);
  }

  // Grouper les mouvements par mois
  const monthlyData: Record<string, { entries: number; exits: number }> = {};

  movements?.forEach((movement) => {
    if (!movement.created_at) return;
    const date = new Date(movement.created_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { entries: 0, exits: 0 };
    }

    if (movement.movement_type === "entry") {
      monthlyData[monthKey].entries += movement.quantity;
    } else {
      monthlyData[monthKey].exits += movement.quantity;
    }
  });

  // Calculer le stock par mois en remontant dans le temps
  const stockByMonth: Record<string, number> = {};
  const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  stockByMonth[currentMonthKey] = currentStock;

  for (let i = 0; i < months; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (i === 0) {
      stockByMonth[monthKey] = currentStock;
    } else {
      const prevMonthDate = new Date();
      prevMonthDate.setMonth(prevMonthDate.getMonth() - i + 1);
      const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;

      const prevMonthData = monthlyData[prevMonthKey] || { entries: 0, exits: 0 };
      const prevStock = stockByMonth[prevMonthKey] || currentStock;

      stockByMonth[monthKey] = prevStock - prevMonthData.entries + prevMonthData.exits;
    }
  }

  // Construire le résultat dans l'ordre chronologique
  const result: StockEvolutionData[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthData = monthlyData[monthKey] || { entries: 0, exits: 0 };

    result.push({
      date: monthKey,
      totalStock: stockByMonth[monthKey] || 0,
      entries: monthData.entries,
      exits: monthData.exits,
    });
  }

  return result;
}

/**
 * Récupère l'évolution du stock d'une catégorie (tous les produits de la catégorie) sur une période
 */
export async function getCategoryStockEvolution(
  categoryId: string,
  months: number = 6
): Promise<StockEvolutionData[]> {
  const supabase = createClient();

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  // Récupérer tous les produits de la catégorie (non archivés)
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, stock_current")
    .eq("category_id", categoryId)
    .is("archived_at", null);

  if (productsError) {
    throw new Error(`Erreur lors de la récupération des produits: ${productsError.message}`);
  }

  if (!products || products.length === 0) {
    // Retourner des données vides si pas de produits dans la catégorie
    const result: StockEvolutionData[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      result.push({
        date: monthKey,
        totalStock: 0,
        entries: 0,
        exits: 0,
      });
    }
    return result;
  }

  const productIds = products.map((p) => p.id);
  const currentTotalStock = products.reduce((sum, p) => sum + (p.stock_current || 0), 0);

  // Récupérer tous les mouvements des produits de la catégorie sur la période
  const { data: movements, error } = await supabase
    .from("stock_movements")
    .select("quantity, movement_type, created_at")
    .in("product_id", productIds)
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Erreur lors de la récupération des mouvements: ${error.message}`);
  }

  // Grouper les mouvements par mois
  const monthlyData: Record<string, { entries: number; exits: number }> = {};

  movements?.forEach((movement) => {
    if (!movement.created_at) return;
    const date = new Date(movement.created_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { entries: 0, exits: 0 };
    }

    if (movement.movement_type === "entry") {
      monthlyData[monthKey].entries += movement.quantity;
    } else {
      monthlyData[monthKey].exits += movement.quantity;
    }
  });

  // Calculer le stock par mois en remontant dans le temps
  const stockByMonth: Record<string, number> = {};
  const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  stockByMonth[currentMonthKey] = currentTotalStock;

  for (let i = 0; i < months; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (i === 0) {
      stockByMonth[monthKey] = currentTotalStock;
    } else {
      const prevMonthDate = new Date();
      prevMonthDate.setMonth(prevMonthDate.getMonth() - i + 1);
      const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;

      const prevMonthData = monthlyData[prevMonthKey] || { entries: 0, exits: 0 };
      const prevStock = stockByMonth[prevMonthKey] || currentTotalStock;

      stockByMonth[monthKey] = prevStock - prevMonthData.entries + prevMonthData.exits;
    }
  }

  // Construire le résultat dans l'ordre chronologique
  const result: StockEvolutionData[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthData = monthlyData[monthKey] || { entries: 0, exits: 0 };

    result.push({
      date: monthKey,
      totalStock: stockByMonth[monthKey] || 0,
      entries: monthData.entries,
      exits: monthData.exits,
    });
  }

  return result;
}

/**
 * Interface pour les données de breakdown hiérarchique
 */
export interface BreakdownItem {
  id: string;
  name: string;
  type: "category" | "product";
  stock: number;
  depth: number;
  children?: BreakdownItem[];
}

export interface MonthlyBreakdown {
  date: string;
  totalStock: number;
  breakdown: BreakdownItem[];
}

/**
 * Récupère le breakdown hiérarchique du stock pour une catégorie donnée
 */
export async function getCategoryBreakdown(
  categoryId: string,
  allCategories: { id: string; name: string; parent_id: string | null }[],
  allProducts: { id: string; name: string; category_id: string | null; stock_current: number }[]
): Promise<BreakdownItem[]> {
  const breakdown: BreakdownItem[] = [];

  // Trouver les sous-catégories directes
  const directSubCategories = allCategories.filter((c) => c.parent_id === categoryId);

  // Trouver les produits directs de cette catégorie
  const directProducts = allProducts.filter((p) => p.category_id === categoryId);

  // Fonction récursive pour calculer le stock total d'une catégorie
  function getCategoryTotalStock(catId: string): number {
    const subCats = allCategories.filter((c) => c.parent_id === catId);
    const products = allProducts.filter((p) => p.category_id === catId);

    let total = products.reduce((sum, p) => sum + (p.stock_current || 0), 0);

    for (const subCat of subCats) {
      total += getCategoryTotalStock(subCat.id);
    }

    return total;
  }

  // Fonction récursive pour construire le breakdown
  function buildBreakdown(
    catId: string,
    depth: number
  ): BreakdownItem[] {
    const items: BreakdownItem[] = [];

    // Sous-catégories
    const subCats = allCategories.filter((c) => c.parent_id === catId);
    for (const subCat of subCats) {
      const subCatStock = getCategoryTotalStock(subCat.id);
      const children = buildBreakdown(subCat.id, depth + 1);

      items.push({
        id: subCat.id,
        name: subCat.name,
        type: "category",
        stock: subCatStock,
        depth,
        children: children.length > 0 ? children : undefined,
      });
    }

    // Produits directs
    const products = allProducts.filter((p) => p.category_id === catId);
    for (const product of products) {
      items.push({
        id: product.id,
        name: product.name,
        type: "product",
        stock: product.stock_current || 0,
        depth,
      });
    }

    return items;
  }

  return buildBreakdown(categoryId, 0);
}

/**
 * Récupère le breakdown global (toutes les catégories racines)
 */
export async function getGlobalBreakdown(
  categoriesTree: { id: string; name: string; parent_id: string | null }[],
  allCategories: { id: string; name: string; parent_id: string | null }[],
  allProducts: { id: string; name: string; category_id: string | null; stock_current: number }[]
): Promise<BreakdownItem[]> {
  const breakdown: BreakdownItem[] = [];

  // Fonction pour calculer le stock total d'une catégorie
  function getCategoryTotalStock(catId: string): number {
    const subCats = allCategories.filter((c) => c.parent_id === catId);
    const products = allProducts.filter((p) => p.category_id === catId);

    let total = products.reduce((sum, p) => sum + (p.stock_current || 0), 0);

    for (const subCat of subCats) {
      total += getCategoryTotalStock(subCat.id);
    }

    return total;
  }

  // Fonction récursive pour construire le breakdown
  function buildCategoryBreakdown(catId: string, depth: number): BreakdownItem[] {
    const items: BreakdownItem[] = [];

    const subCats = allCategories.filter((c) => c.parent_id === catId);
    for (const subCat of subCats) {
      const subCatStock = getCategoryTotalStock(subCat.id);
      const children = buildCategoryBreakdown(subCat.id, depth + 1);

      items.push({
        id: subCat.id,
        name: subCat.name,
        type: "category",
        stock: subCatStock,
        depth,
        children: children.length > 0 ? children : undefined,
      });
    }

    const products = allProducts.filter((p) => p.category_id === catId);
    for (const product of products) {
      items.push({
        id: product.id,
        name: product.name,
        type: "product",
        stock: product.stock_current || 0,
        depth,
      });
    }

    return items;
  }

  // Catégories racines
  const rootCategories = categoriesTree.filter((c) => c.parent_id === null);

  for (const rootCat of rootCategories) {
    const catStock = getCategoryTotalStock(rootCat.id);
    const children = buildCategoryBreakdown(rootCat.id, 1);

    breakdown.push({
      id: rootCat.id,
      name: rootCat.name,
      type: "category",
      stock: catStock,
      depth: 0,
      children: children.length > 0 ? children : undefined,
    });
  }

  // Produits sans catégorie
  const uncategorizedProducts = allProducts.filter((p) => p.category_id === null);
  for (const product of uncategorizedProducts) {
    breakdown.push({
      id: product.id,
      name: product.name,
      type: "product",
      stock: product.stock_current || 0,
      depth: 0,
    });
  }

  return breakdown;
}

/**
 * Récupère les statistiques des techniciens pour le dashboard.
 * Le paramètre needingRestockCount évite une double exécution de
 * getTechniciansNeedingRestock (déjà appelé via useTechniciansNeedingRestock).
 */
export async function getTechnicianStats(
  organizationId?: string,
  needingRestockCount?: number
): Promise<{
  total: number;
  withGoodStock: number;
  withLowStock: number;
  needingRestock: number;
}> {
  const supabase = createClient();

  // Récupérer les techniciens avec leur inventaire (non archivés)
  let query = supabase
    .from("technicians")
    .select(`
      id,
      technician_inventory(
        quantity,
        product:products(stock_max)
      )
    `)
    .is("archived_at", null);

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data: technicians, error } = await query;

  if (error) {
    throw new Error(`Erreur lors de la récupération des techniciens: ${error.message}`);
  }

  let withGoodStock = 0;
  let withLowStock = 0;

  technicians?.forEach((tech) => {
    if (!Array.isArray(tech.technician_inventory) || tech.technician_inventory.length === 0) {
      withLowStock++;
      return;
    }

    // Calculer le score moyen de l'inventaire du technicien
    let totalScore = 0;
    let itemCount = 0;

    tech.technician_inventory.forEach((item: any) => {
      const stockMax = item.product?.stock_max || 100;
      const score = Math.round((item.quantity / stockMax) * 100);
      totalScore += score;
      itemCount++;
    });

    const avgScore = itemCount > 0 ? totalScore / itemCount : 0;

    if (avgScore >= 50) {
      withGoodStock++;
    } else {
      withLowStock++;
    }
  });

  // Utiliser le count pré-calculé si fourni, sinon fallback sur un appel direct
  let restockCount = needingRestockCount;
  if (restockCount === undefined) {
    const techniciansNeedingRestock = await getTechniciansNeedingRestock(7, organizationId);
    restockCount = techniciansNeedingRestock.length;
  }

  return {
    total: technicians?.length || 0,
    withGoodStock,
    withLowStock,
    needingRestock: restockCount,
  };
}
