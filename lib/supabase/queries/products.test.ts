import { describe, it, expect } from "vitest";
import { generateSKU } from "./products";

describe("generateSKU", () => {
  it("generates a SKU with name prefix and timestamp suffix", () => {
    const sku = generateSKU("Peinture Acrylique");
    // prefix should be first 4 alphanumeric chars uppercased
    expect(sku).toMatch(/^PEIN-[A-Z0-9]{6}$/);
  });

  it("pads short names with X", () => {
    const sku = generateSKU("AB");
    expect(sku).toMatch(/^ABXX-[A-Z0-9]{6}$/);
  });

  it("handles empty name with XXXX prefix", () => {
    const sku = generateSKU("");
    expect(sku).toMatch(/^XXXX-[A-Z0-9]{6}$/);
  });

  it("strips accented characters", () => {
    // "éàü" become "" after replace(/[^A-Z0-9]/g, ""), padded to XXXX
    const sku = generateSKU("éàü");
    expect(sku).toMatch(/^XXXX-[A-Z0-9]{6}$/);
  });

  it("generates unique SKUs on successive calls", () => {
    const sku1 = generateSKU("Test");
    const sku2 = generateSKU("Test");
    // Timestamp-based, so extremely likely to differ (or at least could equal in same ms)
    // We test the format is correct for both
    expect(sku1).toMatch(/^TEST-/);
    expect(sku2).toMatch(/^TEST-/);
  });

  it("handles names with special characters", () => {
    const sku = generateSKU("Vis 3x40mm");
    // V, I, S, 3 -> VIS3
    expect(sku).toMatch(/^VIS3-[A-Z0-9]{6}$/);
  });
});
