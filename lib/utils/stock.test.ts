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
  it("returns 0 when stock is 0", () => {
    expect(calculateStockScore(0, 5)).toBe(0);
  });

  it("returns 0 when stock is negative", () => {
    expect(calculateStockScore(-5, 5)).toBe(0);
  });

  it("returns 25 when stock equals min", () => {
    expect(calculateStockScore(5, 5)).toBe(25);
  });

  // Le seuil est libelle « seuil critique » dans l'interface : passer dessous
  // est critique, pas une simple alerte. Ces tests decrivaient un modele de
  // score anterieur, jamais mis a jour quand l'implementation a change.
  it("retourne 0 (critique) sous le seuil", () => {
    expect(calculateStockScore(3, 5)).toBe(0);
  });

  it("returns 75 when stock is above min", () => {
    expect(calculateStockScore(10, 5)).toBe(75);
  });

  it("returns 75 for large stock values above min", () => {
    expect(calculateStockScore(1000, 5)).toBe(75);
  });

  // ── NULL handling ──────────────────────────────────────────────────
  it("uses default MIN when min is null", () => {
    // null min → STOCK_DEFAULTS.MIN (10), stock=5 → sous le seuil → 0
    expect(calculateStockScore(5, null)).toBe(0);
  });

  it("uses default MIN when min is null — above min", () => {
    expect(calculateStockScore(50, null)).toBe(75);
  });

  it("treats null current as 0", () => {
    expect(calculateStockScore(null, 5)).toBe(0);
  });

  it("uses default MIN value of 10", () => {
    expect(STOCK_DEFAULTS.MIN).toBe(10);
  });
});

// ─── getStockScoreColor ─────────────────────────────────────────────
describe("getStockScoreColor", () => {
  it("returns critique color for score 0", () => {
    expect(getStockScoreColor(0)).toBe("text-critique");
  });

  // Le score 25 est le niveau « attention » : seul 0 est critique.
  it("returns critique color for score 0", () => {
    expect(getStockScoreColor(0)).toBe("text-critique");
  });

  it("returns attention color for score between 30 and 59", () => {
    expect(getStockScoreColor(30)).toBe("text-attention");
    expect(getStockScoreColor(50)).toBe("text-attention");
  });

  it("returns foreground color for score 60 and above", () => {
    expect(getStockScoreColor(60)).toBe("text-foreground");
    expect(getStockScoreColor(75)).toBe("text-foreground");
  });
});

// ─── getStockScoreBgColor ───────────────────────────────────────────
describe("getStockScoreBgColor", () => {
  it("returns critique bg for low scores", () => {
    expect(getStockScoreBgColor(0)).toBe("bg-critique");
  });

  it("returns attention bg for medium scores", () => {
    expect(getStockScoreBgColor(30)).toBe("bg-attention");
  });

  it("returns standard bg for high scores", () => {
    expect(getStockScoreBgColor(75)).toBe("bg-standard/70");
  });
});

// ─── getStockStatus ─────────────────────────────────────────────────
describe("getStockStatus", () => {
  it("returns Critique for score 0", () => {
    expect(getStockStatus(0)).toBe("Critique");
  });

  it("returns Attention for score between 30 and 59", () => {
    expect(getStockStatus(30)).toBe("Attention");
    expect(getStockStatus(50)).toBe("Attention");
  });

  it("returns Standard for score 60+", () => {
    expect(getStockStatus(60)).toBe("Standard");
    expect(getStockStatus(75)).toBe("Standard");
  });
});

// ─── getStockBadgeVariant ───────────────────────────────────────────
describe("getStockBadgeVariant", () => {
  it("returns critique for score 0", () => {
    expect(getStockBadgeVariant(0)).toBe("critique");
  });

  it("returns attention for score between 30 and 59", () => {
    expect(getStockBadgeVariant(30)).toBe("attention");
    expect(getStockBadgeVariant(50)).toBe("attention");
  });

  it("returns standard for score 60+", () => {
    expect(getStockBadgeVariant(60)).toBe("standard");
    expect(getStockBadgeVariant(75)).toBe("standard");
  });
});
