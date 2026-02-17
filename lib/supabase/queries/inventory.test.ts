import { describe, it, expect } from "vitest";
import { calculateInventoryPercentage } from "./inventory";

describe("calculateInventoryPercentage", () => {
  it("calculates normal percentage", () => {
    expect(calculateInventoryPercentage(50, 100)).toBe(50);
  });

  it("returns 0 when stockMax is 0", () => {
    expect(calculateInventoryPercentage(10, 0)).toBe(0);
  });

  it("returns 0 when stockMax is negative", () => {
    expect(calculateInventoryPercentage(10, -5)).toBe(0);
  });

  it("caps at 100 even if quantity exceeds stockMax", () => {
    expect(calculateInventoryPercentage(150, 100)).toBe(100);
  });

  it("returns 0 when quantity is 0", () => {
    expect(calculateInventoryPercentage(0, 100)).toBe(0);
  });
});
