/**
 * Default stock thresholds used when values are not configured (null).
 */
export const STOCK_DEFAULTS = {
  MIN: 10,
  MAX: 100,
} as const;

/**
 * Calcule le score de stock d'un produit (0-100%)
 *
 * Logique :
 * - stock_min ou stock_max null → utilise les defaults (10 / 100)
 * - min = max et stock = min → 100% (cible atteinte)
 * - stock ≤ stock_min → 0% (critique bas)
 * - stock entre min et max → ((stock - min) / (max - min)) * 100
 * - stock = max → 100% (optimal)
 * - stock > max → le % redescend : 100 - (((stock - max) / max) * 100)
 * - stock ≥ 2× max → 0% (surstockage critique)
 *
 * @param current - Stock actuel (null treated as 0)
 * @param min - Stock minimum / seuil d'alerte (null → STOCK_DEFAULTS.MIN)
 * @param max - Stock maximum / niveau optimal (null → STOCK_DEFAULTS.MAX)
 * @returns Score entre 0 et 100
 */
export function calculateStockScore(
  current: number | null,
  min: number | null,
  max: number | null
): number {
  const c = current ?? 0;
  const mn = min ?? STOCK_DEFAULTS.MIN;
  const mx = max ?? STOCK_DEFAULTS.MAX;

  // Validation des entrées
  if (mx <= 0 || mn < 0 || c < 0) {
    return 0;
  }

  // Cas spécial: min = max (cible fixe)
  if (mn === mx) {
    if (c === mn) return 100;
    if (c < mn) return 0;
    // Surstockage au-dessus de la cible fixe
    if (c >= mx * 2) return 0;
    const overstock = c - mx;
    const overstockRatio = overstock / mx;
    return Math.round(Math.max(0, 100 - overstockRatio * 100));
  }

  // Cas 1: Stock critique bas (≤ min)
  if (c <= mn) {
    return 0;
  }

  // Cas 2: Stock entre min et max (zone normale)
  if (c <= mx) {
    const range = mx - mn;
    return Math.round(((c - mn) / range) * 100);
  }

  // Cas 3: Surstockage critique (≥ 2× max)
  if (c >= mx * 2) {
    return 0;
  }

  // Cas 4: Surstockage modéré (entre max et 2× max)
  // Le score redescend de 100% à 0%
  const overstock = c - mx;
  const overstockRatio = overstock / mx;
  return Math.round(Math.max(0, 100 - overstockRatio * 100));
}

/**
 * Retourne la couleur appropriée selon le score de stock
 * @param score - Score de stock (0-100)
 * @returns Classe CSS de couleur
 */
export function getStockScoreColor(score: number): string {
  if (score < 30) return "text-red-500";
  if (score < 60) return "text-orange-500";
  return "text-green-500";
}

/**
 * Retourne la couleur de fond appropriée selon le score de stock
 * @param score - Score de stock (0-100)
 * @returns Classe CSS de couleur de fond
 */
export function getStockScoreBgColor(score: number): string {
  if (score < 30) return "bg-red-500";
  if (score < 60) return "bg-orange-500";
  return "bg-green-500";
}

/**
 * Retourne le statut textuel du stock
 * @param score - Score de stock (0-100)
 * @returns Statut en français
 */
export function getStockStatus(score: number): string {
  if (score === 0) return "Critique";
  if (score < 30) return "Bas";
  if (score < 60) return "Attention";
  if (score < 90) return "Bon";
  return "Optimal";
}

/**
 * Retourne le variant de badge selon le score
 * @param score - Score de stock (0-100)
 * @returns Variant du badge
 */
export function getStockBadgeVariant(score: number): "destructive" | "warning" | "success" {
  if (score < 30) return "destructive";
  if (score < 60) return "warning";
  return "success";
}
