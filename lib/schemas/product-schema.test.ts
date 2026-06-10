import { describe, it, expect } from "vitest";
import { ProductFormSchema } from "./product-schema";

describe("ProductFormSchema", () => {
  const validProduct = {
    name: "Produit test",
    is_perishable: false,
    track_stock: true,
  };

  // ─── name ──────────────────────────────────────────────────────────
  it("accepts a valid product name", () => {
    const result = ProductFormSchema.safeParse(validProduct);
    expect(result.success).toBe(true);
  });

  it("rejects name shorter than 2 characters", () => {
    const result = ProductFormSchema.safeParse({ ...validProduct, name: "A" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("name");
    }
  });

  it("rejects empty name", () => {
    const result = ProductFormSchema.safeParse({ ...validProduct, name: "" });
    expect(result.success).toBe(false);
  });

  // ─── price ─────────────────────────────────────────────────────────
  it("accepts a valid price string", () => {
    const result = ProductFormSchema.safeParse({ ...validProduct, price: "19.99" });
    expect(result.success).toBe(true);
  });

  it("accepts empty price (optional)", () => {
    const result = ProductFormSchema.safeParse({ ...validProduct, price: "" });
    expect(result.success).toBe(true);
  });

  it("accepts undefined price (optional)", () => {
    const result = ProductFormSchema.safeParse(validProduct);
    expect(result.success).toBe(true);
  });

  it("rejects non-numeric price string", () => {
    const result = ProductFormSchema.safeParse({ ...validProduct, price: "abc" });
    expect(result.success).toBe(false);
  });

  it("accepts price of 0", () => {
    const result = ProductFormSchema.safeParse({ ...validProduct, price: "0" });
    expect(result.success).toBe(true);
  });

  // ─── stock fields ──────────────────────────────────────────────────
  it("accepts valid stock_current string", () => {
    const result = ProductFormSchema.safeParse({ ...validProduct, stock_current: "50" });
    expect(result.success).toBe(true);
  });

  it("rejects non-numeric stock_current", () => {
    const result = ProductFormSchema.safeParse({ ...validProduct, stock_current: "abc" });
    expect(result.success).toBe(false);
  });

  it("accepts valid stock_min string", () => {
    const result = ProductFormSchema.safeParse({ ...validProduct, stock_min: "10" });
    expect(result.success).toBe(true);
  });

  it("rejects non-numeric stock_min", () => {
    const result = ProductFormSchema.safeParse({ ...validProduct, stock_min: "xyz" });
    expect(result.success).toBe(false);
  });

  it("accepts valid stock_max string", () => {
    const result = ProductFormSchema.safeParse({ ...validProduct, stock_max: "100" });
    expect(result.success).toBe(true);
  });

  it("rejects non-numeric stock_max", () => {
    const result = ProductFormSchema.safeParse({ ...validProduct, stock_max: "---" });
    expect(result.success).toBe(false);
  });

  // ─── booleans ──────────────────────────────────────────────────────
  it("requires is_perishable boolean", () => {
    const { is_perishable: _, ...without } = validProduct;
    const result = ProductFormSchema.safeParse(without);
    expect(result.success).toBe(false);
  });

  it("requires track_stock boolean", () => {
    const { track_stock: _, ...without } = validProduct;
    const result = ProductFormSchema.safeParse(without);
    expect(result.success).toBe(false);
  });

  // ─── optional fields ──────────────────────────────────────────────
  it("accepts optional sku", () => {
    const result = ProductFormSchema.safeParse({ ...validProduct, sku: "ABC-123" });
    expect(result.success).toBe(true);
  });

  it("accepts optional category_id", () => {
    const result = ProductFormSchema.safeParse({ ...validProduct, category_id: "cat-1" });
    expect(result.success).toBe(true);
  });

  it("accepts null icon_name", () => {
    const result = ProductFormSchema.safeParse({ ...validProduct, icon_name: null });
    expect(result.success).toBe(true);
  });
});
