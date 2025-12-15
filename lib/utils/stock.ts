/**
 * Calcule le score de stock d'un produit (0-100%)
 *
 * Logique :
 * - stock ≤ stock_min → 0% (critique bas)
 * - stock entre min et max → ((stock - min) / (max - min)) * 100
 * - stock = max → 100% (optimal)
 * - stock > max → le % redescend : 100 - (((stock - max) / max) * 100)
 * - stock ≥ 2× max → 0% (surstockage critique)
 *
 * @param current - Stock actuel
 * @param min - Stock minimum (seuil d'alerte)
 * @param max - Stock maximum (niveau optimal)
 * @returns Score entre 0 et 100
 */
export function calculateStockScore(
  current: number,
  min: number,
  max: number
): number {
  // Validation des entrées
  if (max <= 0 || min < 0 || current < 0) {
    return 0;
  }

  // Cas 1: Stock critique bas (≤ min)
  if (current <= min) {
    return 0;
  }

  // Cas 2: Stock entre min et max (zone normale)
  if (current <= max) {
    const range = max - min;
    if (range === 0) return 100;
    return Math.round(((current - min) / range) * 100);
  }

  // Cas 3: Surstockage critique (≥ 2× max)
  if (current >= max * 2) {
    return 0;
  }

  // Cas 4: Surstockage modéré (entre max et 2× max)
  // Le score redescend de 100% à 0%
  const overstock = current - max;
  const overstockRatio = overstock / max;
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
export function getStockBadgeVariant(
  score: number
): "destructive" | "warning" | "success" | "secondary" {
  if (score < 30) return "destructive";
  if (score < 60) return "warning";
  if (score >= 60) return "success";
  return "secondary";
}
