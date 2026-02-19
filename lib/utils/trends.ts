export interface TrendResult {
  direction: "up" | "down" | "stable";
  percentage: number;
}

/**
 * Calculates trend between current and previous values.
 * Returns direction and percentage change.
 */
export function computeTrend(current: number, previous: number): TrendResult {
  if (previous === 0) {
    if (current === 0) return { direction: "stable", percentage: 0 };
    return { direction: "up", percentage: 100 };
  }

  const change = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(Math.abs(change) * 10) / 10;

  if (Math.abs(change) < 0.5) {
    return { direction: "stable", percentage: 0 };
  }

  return {
    direction: change > 0 ? "up" : "down",
    percentage: rounded,
  };
}
