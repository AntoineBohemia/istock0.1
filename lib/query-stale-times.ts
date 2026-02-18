export const STALE_TIME = {
  REALTIME: 30_000, // produits, mouvements, dashboard stats
  MODERATE: 60_000, // stats agreges, summaries
  SLOW: 5 * 60_000, // categories, organisations, evolution charts
} as const;
