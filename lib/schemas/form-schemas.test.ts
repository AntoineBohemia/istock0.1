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

  it("rejects name shorter than 2 characters", () => {
    const result = ProductFormSchema.safeParse({
      name: "A",
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

  // BUG: price is a z.string().optional(), so "abc" passes Zod validation
  // but will produce NaN when parseInt/parseFloat is called in the form submit handler
  it("BUG: accepts non-numeric price string (NaN at runtime)", () => {
    const result = ProductFormSchema.safeParse({
      name: "Widget",
      price: "abc",
      is_perishable: false,
      track_stock: true,
    });
    // Zod passes because price is just z.string().optional()
    expect(result.success).toBe(true);

    // But at runtime this will produce NaN:
    if (result.success) {
      const parsed = parseFloat(result.data.price!);
      expect(Number.isNaN(parsed)).toBe(true);
    }
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
