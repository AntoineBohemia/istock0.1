/**
 * Default stock threshold used when value is not configured (null).
 */
export const STOCK_DEFAULTS = {
  MIN: 10,
} as const;

/**
 * Calcule le score de stock d'un produit (0, 25, 75)
 *
 * Logique simplifiée à 3 niveaux :
 * - stock = 0         → 0  (critique)
 * - stock <= min      → 25 (attention)
 * - stock > min       → 75 (standard)
 *
 * @param current - Stock actuel (null treated as 0)
 * @param min - Stock minimum / seuil d'alerte (null → STOCK_DEFAULTS.MIN)
 * @returns Score : 0, 25 ou 75
 */
export function calculateStockScore(current: number | null, min: number | null): number {
  const c = current ?? 0;
  const mn = min ?? STOCK_DEFAULTS.MIN;

  if (c <= 0) return 0;
  if (c <= mn) return 25;
  return 75;
}

/**
 * Retourne la couleur appropriée selon le score de stock
 * @param score - Score de stock (0-100)
 * @returns Classe CSS de couleur
 */
export function getStockScoreColor(score: number): string {
  if (score < 30) return "text-critique";
  if (score < 60) return "text-attention";
  return "text-foreground";
}

/**
 * Retourne la couleur de fond appropriée selon le score de stock
 * @param score - Score de stock (0-100)
 * @returns Classe CSS de couleur de fond
 */
export function getStockScoreBgColor(score: number): string {
  if (score < 30) return "bg-critique";
  if (score < 60) return "bg-attention";
  return "bg-standard/70";
}

/**
 * Retourne le statut textuel du stock
 * @param score - Score de stock (0-100)
 * @returns Statut en français
 */
export function getStockStatus(score: number): string {
  if (score < 30) return "Critique";
  if (score < 60) return "Attention";
  return "Standard";
}

/**
 * Retourne le niveau de statut selon le score
 * @param score - Score de stock (0-100)
 * @returns Niveau de statut design system
 */
export function getStockBadgeVariant(score: number): "critique" | "attention" | "standard" {
  if (score < 30) return "critique";
  if (score < 60) return "attention";
  return "standard";
}
