import { describe, it, expect } from "vitest";
import {
  calculateStockScore,
  getStockScoreColor,
  getStockScoreBgColor,
  getStockStatus,
  getStockBadgeVariant,
  STOCK_DEFAULTS,
} from "./stock";

// ─── calculateStockScore ────────────────────────────────────────────
describe("calculateStockScore", () => {
  // ── Basic cases ──────────────────────────────────────────────────
  it("returns 0 when stock equals 0", () => {
    expect(calculateStockScore(0, 5, 20)).toBe(0);
  });

  it("returns 0 when stock equals min", () => {
    expect(calculateStockScore(5, 5, 20)).toBe(0);
  });

  it("returns 0 when stock is below min", () => {
    expect(calculateStockScore(3, 5, 20)).toBe(0);
  });

  it("returns score between 0 and 100 when stock is between min and max", () => {
    const score = calculateStockScore(12, 5, 20);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
    // (12-5)/(20-5) * 100 = 47
    expect(score).toBe(47);
  });

  it("returns 50 when stock is at midpoint between min and max", () => {
    expect(calculateStockScore(15, 10, 20)).toBe(50);
  });

  it("returns 100 when stock equals max", () => {
    expect(calculateStockScore(20, 5, 20)).toBe(100);
  });

  // ── Overstock ────────────────────────────────────────────────────
  it("returns decreasing score for moderate overstock (between max and 2*max)", () => {
    expect(calculateStockScore(25, 5, 20)).toBe(75);
  });

  it("returns 50 when stock is 1.5x max", () => {
    expect(calculateStockScore(30, 5, 20)).toBe(50);
  });

  it("returns 0 when stock equals 2x max (critical overstock)", () => {
    expect(calculateStockScore(40, 5, 20)).toBe(0);
  });

  it("returns 0 when stock exceeds 2x max", () => {
    expect(calculateStockScore(50, 5, 20)).toBe(0);
  });

  // ── Edge: max is 0 or negative ──────────────────────────────────
  it("returns 0 when max is 0", () => {
    expect(calculateStockScore(10, 5, 0)).toBe(0);
  });

  it("returns 0 for negative current", () => {
    expect(calculateStockScore(-5, 5, 20)).toBe(0);
  });

  it("returns 0 for negative min", () => {
    expect(calculateStockScore(10, -1, 20)).toBe(0);
  });

  it("returns 0 for negative max", () => {
    expect(calculateStockScore(10, 5, -1)).toBe(0);
  });

  // ── min === max (fixed target) ──────────────────────────────────
  it("returns 100 when min equals max and stock equals that target", () => {
    expect(calculateStockScore(10, 10, 10)).toBe(100);
  });

  it("returns 0 when min equals max and stock is below target", () => {
    expect(calculateStockScore(5, 10, 10)).toBe(0);
  });

  it("returns decreasing score when min equals max and stock is above target", () => {
    // current=11, min=10, max=10 -> overstock=1, ratio=0.1, score=90
    expect(calculateStockScore(11, 10, 10)).toBe(90);
  });

  it("returns 0 when min equals max and stock is 2x target", () => {
    expect(calculateStockScore(20, 10, 10)).toBe(0);
  });

  // ── NULL handling (the main bug fix) ────────────────────────────
  it("uses default MIN when min is null", () => {
    // null min → STOCK_DEFAULTS.MIN (10), max=100
    // score = (50-10)/(100-10)*100 = 44
    expect(calculateStockScore(50, null, 100)).toBe(44);
  });

  it("uses default MAX when max is null", () => {
    // min=10, null max → STOCK_DEFAULTS.MAX (100)
    // score = (50-10)/(100-10)*100 = 44
    expect(calculateStockScore(50, 10, null)).toBe(44);
  });

  it("uses both defaults when both are null", () => {
    // null min → 10, null max → 100
    // score = (50-10)/(100-10)*100 = 44
    expect(calculateStockScore(50, null, null)).toBe(44);
  });

  it("treats null current as 0", () => {
    expect(calculateStockScore(null, 5, 20)).toBe(0);
  });

  it("does NOT return 0 when max is null (uses default instead)", () => {
    // Previously: null max → 0 → score always 0. Now uses default 100.
    const score = calculateStockScore(50, null, null);
    expect(score).toBeGreaterThan(0);
  });

  it("gives sensible score for product with no thresholds configured", () => {
    // stock=80, min=null(→10), max=null(→100) → (80-10)/(100-10)*100 = 78
    expect(calculateStockScore(80, null, null)).toBe(78);
  });

  it("gives 100% when stock equals default max and thresholds are null", () => {
    expect(calculateStockScore(STOCK_DEFAULTS.MAX, null, null)).toBe(100);
  });

  it("gives 0% when stock is at or below default min and thresholds are null", () => {
    expect(calculateStockScore(STOCK_DEFAULTS.MIN, null, null)).toBe(0);
    expect(calculateStockScore(5, null, null)).toBe(0);
  });
});

// ─── getStockScoreColor ─────────────────────────────────────────────
describe("getStockScoreColor", () => {
  it("returns red for score 0", () => {
    expect(getStockScoreColor(0)).toBe("text-red-500");
  });

  it("returns red for score below 30", () => {
    expect(getStockScoreColor(29)).toBe("text-red-500");
  });

  it("returns orange for score exactly 30", () => {
    expect(getStockScoreColor(30)).toBe("text-orange-500");
  });

  it("returns orange for score below 60", () => {
    expect(getStockScoreColor(59)).toBe("text-orange-500");
  });

  it("returns green for score 60 and above", () => {
    expect(getStockScoreColor(60)).toBe("text-green-500");
    expect(getStockScoreColor(100)).toBe("text-green-500");
  });
});

// ─── getStockScoreBgColor ───────────────────────────────────────────
describe("getStockScoreBgColor", () => {
  it("returns bg-red for low scores", () => {
    expect(getStockScoreBgColor(10)).toBe("bg-red-500");
  });

  it("returns bg-orange for medium scores", () => {
    expect(getStockScoreBgColor(45)).toBe("bg-orange-500");
  });

  it("returns bg-green for high scores", () => {
    expect(getStockScoreBgColor(80)).toBe("bg-green-500");
  });
});

// ─── getStockStatus ─────────────────────────────────────────────────
describe("getStockStatus", () => {
  it("returns Critique for score 0", () => {
    expect(getStockStatus(0)).toBe("Critique");
  });

  it("returns Bas for score between 1 and 29", () => {
    expect(getStockStatus(15)).toBe("Bas");
  });

  it("returns Attention for score between 30 and 59", () => {
    expect(getStockStatus(45)).toBe("Attention");
  });

  it("returns Bon for score between 60 and 89", () => {
    expect(getStockStatus(75)).toBe("Bon");
  });

  it("returns Optimal for score 90+", () => {
    expect(getStockStatus(90)).toBe("Optimal");
    expect(getStockStatus(100)).toBe("Optimal");
  });
});

// ─── getStockBadgeVariant ───────────────────────────────────────────
describe("getStockBadgeVariant", () => {
  it("returns destructive for score below 30", () => {
    expect(getStockBadgeVariant(10)).toBe("destructive");
  });

  it("returns warning for score between 30 and 59", () => {
    expect(getStockBadgeVariant(45)).toBe("warning");
  });

  it("returns success for score 60 and above", () => {
    expect(getStockBadgeVariant(80)).toBe("success");
  });

  it("returns success for score 100", () => {
    expect(getStockBadgeVariant(100)).toBe("success");
  });
});
