import { createClient } from "@/lib/supabase/client";
import { calculateStockScore } from "@/lib/utils/stock";

export interface DashboardStats {
  totalStock: number;
  totalValue: number;
  monthlyEntries: number;
  monthlyExits: number;
  totalProducts: number;
  lowStockCount: number;
}

export interface ProductNeedingRestock {
  id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  stock_current: number;
  stock_min: number;
  stock_max: number;
  score: number;
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
  created_at: string;
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
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = createClient();

  // Récupérer tous les produits pour calculer les stats
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("stock_current, stock_min, stock_max, price");

  if (productsError) {
    throw new Error(`Erreur lors de la récupération des produits: ${productsError.message}`);
  }

  // Calculer les totaux
  let totalStock = 0;
  let totalValue = 0;
  let lowStockCount = 0;

  products?.forEach((product) => {
    totalStock += product.stock_current || 0;
    totalValue += (product.stock_current || 0) * (product.price || 0);

    const score = calculateStockScore(
      product.stock_current,
      product.stock_min,
      product.stock_max
    );
    if (score < 30) {
      lowStockCount++;
    }
  });

  // Récupérer les mouvements du mois
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: movements, error: movementsError } = await supabase
    .from("stock_movements")
    .select("quantity, movement_type")
    .gte("created_at", startOfMonth.toISOString());

  if (movementsError) {
    throw new Error(`Erreur lors de la récupération des mouvements: ${movementsError.message}`);
  }

  let monthlyEntries = 0;
  let monthlyExits = 0;

  movements?.forEach((movement) => {
    if (movement.movement_type === "entry") {
      monthlyEntries += movement.quantity;
    } else {
      monthlyExits += movement.quantity;
    }
  });

  return {
    totalStock,
    totalValue,
    monthlyEntries,
    monthlyExits,
    totalProducts: products?.length || 0,
    lowStockCount,
  };
}

/**
 * Récupère les produits nécessitant un réapprovisionnement (score < 30%)
 */
export async function getProductsNeedingRestock(
  limit: number = 10
): Promise<ProductNeedingRestock[]> {
  const supabase = createClient();

  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, sku, image_url, stock_current, stock_min, stock_max")
    .order("stock_current", { ascending: true });

  if (error) {
    throw new Error(`Erreur lors de la récupération des produits: ${error.message}`);
  }

  // Filtrer et calculer le score
  const productsWithScore = products
    ?.map((product) => ({
      ...product,
      score: calculateStockScore(
        product.stock_current,
        product.stock_min,
        product.stock_max
      ),
    }))
    .filter((product) => product.score < 30)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);

  return productsWithScore || [];
}

/**
 * Récupère les techniciens dont le dernier restock date de plus de X jours
 */
export async function getTechniciansNeedingRestock(
  daysThreshold: number = 7
): Promise<TechnicianNeedingRestock[]> {
  const supabase = createClient();

  // Récupérer tous les techniciens avec leur inventaire
  const { data: technicians, error: techniciansError } = await supabase
    .from("technicians")
    .select(`
      id,
      first_name,
      last_name,
      technician_inventory(id)
    `);

  if (techniciansError) {
    throw new Error(`Erreur lors de la récupération des techniciens: ${techniciansError.message}`);
  }

  // Récupérer le dernier restock de chaque technicien via l'historique
  const { data: historyEntries, error: historyError } = await supabase
    .from("technician_inventory_history")
    .select("technician_id, created_at")
    .order("created_at", { ascending: false });

  if (historyError) {
    throw new Error(`Erreur lors de la récupération de l'historique: ${historyError.message}`);
  }

  // Grouper par technicien (prendre le plus récent)
  const lastRestockByTechnician: Record<string, string> = {};
  historyEntries?.forEach((entry) => {
    if (!lastRestockByTechnician[entry.technician_id]) {
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
  limit: number = 10
): Promise<RecentMovement[]> {
  const supabase = createClient();

  const { data, error } = await supabase
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
 * Récupère l'évolution globale du stock sur une période
 */
export async function getGlobalStockEvolution(
  months: number = 6
): Promise<StockEvolutionData[]> {
  const supabase = createClient();

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  // Récupérer tous les mouvements sur la période
  const { data: movements, error } = await supabase
    .from("stock_movements")
    .select("quantity, movement_type, created_at")
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Erreur lors de la récupération des mouvements: ${error.message}`);
  }

  // Récupérer le stock actuel total
  const { data: products } = await supabase
    .from("products")
    .select("stock_current");

  const currentTotalStock =
    products?.reduce((sum, p) => sum + (p.stock_current || 0), 0) || 0;

  // Grouper les mouvements par mois
  const monthlyData: Record<string, { entries: number; exits: number }> = {};

  movements?.forEach((movement) => {
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
 * Récupère les statistiques des techniciens pour le dashboard
 */
export async function getTechnicianStats(): Promise<{
  total: number;
  withGoodStock: number;
  withLowStock: number;
  needingRestock: number;
}> {
  const supabase = createClient();

  // Récupérer les techniciens avec leur inventaire
  const { data: technicians, error } = await supabase
    .from("technicians")
    .select(`
      id,
      technician_inventory(
        quantity,
        product:products(stock_max)
      )
    `);

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

  // Récupérer les techniciens à restocker
  const techniciansNeedingRestock = await getTechniciansNeedingRestock(7);

  return {
    total: technicians?.length || 0,
    withGoodStock,
    withLowStock,
    needingRestock: techniciansNeedingRestock.length,
  };
}
