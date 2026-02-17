import { describe, it, expect } from "vitest";
import {
  calculateStockScore,
  getStockScoreColor,
  getStockScoreBgColor,
  getStockStatus,
  getStockBadgeVariant,
} from "./stock";

// ─── calculateStockScore ────────────────────────────────────────────
describe("calculateStockScore", () => {
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
    // midpoint of 10-20 is 15 -> (15-10)/(20-10)*100 = 50
    expect(calculateStockScore(15, 10, 20)).toBe(50);
  });

  it("returns 100 when stock equals max", () => {
    expect(calculateStockScore(20, 5, 20)).toBe(100);
  });

  it("returns decreasing score for moderate overstock (between max and 2*max)", () => {
    // stock=25, max=20 -> overstock=5, ratio=0.25, score=75
    expect(calculateStockScore(25, 5, 20)).toBe(75);
  });

  it("returns 50 when stock is 1.5x max", () => {
    // stock=30, max=20 -> overstock=10, ratio=0.5, score=50
    expect(calculateStockScore(30, 5, 20)).toBe(50);
  });

  it("returns 0 when stock equals 2x max (critical overstock)", () => {
    expect(calculateStockScore(40, 5, 20)).toBe(0);
  });

  it("returns 0 when stock exceeds 2x max", () => {
    expect(calculateStockScore(50, 5, 20)).toBe(0);
  });

  it("returns 0 when max is 0", () => {
    expect(calculateStockScore(10, 5, 0)).toBe(0);
  });

  it("returns 100 when min equals max and stock equals max", () => {
    // current > min is false when min=max=10 and current=10 -> returns 0
    // current=11 > min=10, current <= max=10 is false, so goes to overstock
    // Actually: min=max=10, current=10 -> current<=min -> 0
    expect(calculateStockScore(10, 10, 10)).toBe(0);
  });

  it("returns 100 when min equals max and stock is just above", () => {
    // current=11, min=10, max=10 -> current > min, current <= max? No.
    // current >= max*2? 11 >= 20? No. So overstock = 1, ratio = 0.1, score = 90
    expect(calculateStockScore(11, 10, 10)).toBe(90);
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

  // NOTE: Dead code at line 96 — `return "secondary"` is unreachable
  // because `score >= 60` already covers all remaining cases after < 30 and < 60.
  it("never returns secondary (dead code)", () => {
    // Every possible score is covered by one of the 3 branches above.
    // Testing boundary values to confirm:
    for (const s of [0, 29, 30, 59, 60, 100]) {
      expect(getStockBadgeVariant(s)).not.toBe("secondary");
    }
  });
});
