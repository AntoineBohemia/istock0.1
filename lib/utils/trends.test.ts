import { describe, it, expect } from "vitest";
import { computeTrend } from "./trends";

describe("computeTrend", () => {
  it("returns stable when both values are 0", () => {
    expect(computeTrend(0, 0)).toEqual({ direction: "stable", percentage: 0 });
  });

  it("returns up 100% when previous is 0 and current > 0", () => {
    expect(computeTrend(10, 0)).toEqual({ direction: "up", percentage: 100 });
  });

  it("returns up for positive change", () => {
    const result = computeTrend(150, 100);
    expect(result.direction).toBe("up");
    expect(result.percentage).toBe(50);
  });

  it("returns down for negative change", () => {
    const result = computeTrend(50, 100);
    expect(result.direction).toBe("down");
    expect(result.percentage).toBe(50);
  });

  it("returns stable for very small change (< 0.5%)", () => {
    const result = computeTrend(1000, 999);
    expect(result.direction).toBe("stable");
    expect(result.percentage).toBe(0);
  });

  it("handles negative previous value", () => {
    const result = computeTrend(10, -10);
    expect(result.direction).toBe("up");
    expect(result.percentage).toBe(200);
  });

  it("rounds percentage to one decimal", () => {
    // (120 - 100) / 100 * 100 = 20.0
    const result = computeTrend(120, 100);
    expect(result.percentage).toBe(20);
  });

  it("handles decrease to 0", () => {
    const result = computeTrend(0, 100);
    expect(result.direction).toBe("down");
    expect(result.percentage).toBe(100);
  });
});
