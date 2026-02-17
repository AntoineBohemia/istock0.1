import { describe, it, expect } from "vitest";
import { MovementFormSchema } from "./movement-schema";
import { ProductFormSchema } from "./product-schema";
import { TechnicianFormSchema } from "./technician-schema";

// ─── MovementFormSchema ─────────────────────────────────────────────
describe("MovementFormSchema", () => {
  it("accepts valid entry data", () => {
    const result = MovementFormSchema.safeParse({
      direction: "entry",
      product_id: "prod-1",
      quantity: 10,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing direction", () => {
    const result = MovementFormSchema.safeParse({
      product_id: "prod-1",
      quantity: 10,
    });
    expect(result.success).toBe(false);
  });

  it("rejects quantity of 0", () => {
    const result = MovementFormSchema.safeParse({
      direction: "entry",
      product_id: "prod-1",
      quantity: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty product_id", () => {
    const result = MovementFormSchema.safeParse({
      direction: "entry",
      product_id: "",
      quantity: 5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts exit with optional fields", () => {
    const result = MovementFormSchema.safeParse({
      direction: "exit",
      exit_type: "exit_technician",
      product_id: "prod-1",
      technician_id: "tech-1",
      quantity: 3,
      notes: "urgent",
    });
    expect(result.success).toBe(true);
  });
});

// ─── ProductFormSchema ──────────────────────────────────────────────
describe("ProductFormSchema", () => {
  it("accepts valid product data", () => {
    const result = ProductFormSchema.safeParse({
      name: "Peinture Blanche",
      is_perishable: false,
      track_stock: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid product with all optional fields", () => {
    const result = ProductFormSchema.safeParse({
      name: "Peinture Blanche",
      sku: "PB-001",
      description: "Peinture mate",
      price: "25.99",
      stock_current: "10",
      stock_min: "5",
      stock_max: "100",
      category_id: "cat-1",
      supplier_name: "Fournisseur A",
      is_perishable: false,
      track_stock: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects name shorter than 2 characters", () => {
    const result = ProductFormSchema.safeParse({
      name: "A",
      is_perishable: false,
      track_stock: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = ProductFormSchema.safeParse({
      name: "",
      is_perishable: false,
      track_stock: true,
    });
    expect(result.success).toBe(false);
  });

  it("requires is_perishable boolean", () => {
    const result = ProductFormSchema.safeParse({
      name: "Valid",
      track_stock: true,
    });
    expect(result.success).toBe(false);
  });

  it("requires track_stock boolean", () => {
    const result = ProductFormSchema.safeParse({
      name: "Valid",
      is_perishable: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric price string", () => {
    const result = ProductFormSchema.safeParse({
      name: "Widget",
      price: "abc",
      is_perishable: false,
      track_stock: true,
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid numeric price string", () => {
    const result = ProductFormSchema.safeParse({
      name: "Widget",
      price: "29.99",
      is_perishable: false,
      track_stock: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts price of 0", () => {
    const result = ProductFormSchema.safeParse({
      name: "Free Item",
      price: "0",
      is_perishable: false,
      track_stock: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty/undefined price", () => {
    const result = ProductFormSchema.safeParse({
      name: "No Price",
      is_perishable: false,
      track_stock: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-numeric stock_current", () => {
    const result = ProductFormSchema.safeParse({
      name: "Widget",
      stock_current: "abc",
      is_perishable: false,
      track_stock: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric stock_min", () => {
    const result = ProductFormSchema.safeParse({
      name: "Widget",
      stock_min: "xyz",
      is_perishable: false,
      track_stock: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric stock_max", () => {
    const result = ProductFormSchema.safeParse({
      name: "Widget",
      stock_max: "not-a-number",
      is_perishable: false,
      track_stock: true,
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid numeric stock values", () => {
    const result = ProductFormSchema.safeParse({
      name: "Widget",
      stock_current: "10",
      stock_min: "5",
      stock_max: "100",
      is_perishable: false,
      track_stock: true,
    });
    expect(result.success).toBe(true);
  });
});

// ─── TechnicianFormSchema ───────────────────────────────────────────
describe("TechnicianFormSchema", () => {
  it("accepts valid technician data", () => {
    const result = TechnicianFormSchema.safeParse({
      first_name: "Jean",
      last_name: "Dupont",
      email: "jean@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects first_name shorter than 2 characters", () => {
    const result = TechnicianFormSchema.safeParse({
      first_name: "J",
      last_name: "Dupont",
      email: "j@d.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = TechnicianFormSchema.safeParse({
      first_name: "Jean",
      last_name: "Dupont",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("allows optional phone and city", () => {
    const result = TechnicianFormSchema.safeParse({
      first_name: "Jean",
      last_name: "Dupont",
      email: "jean@example.com",
      phone: "0612345678",
      city: "Paris",
    });
    expect(result.success).toBe(true);
  });
});
