import { describe, it, expect } from "vitest";
import { MovementFormSchema } from "./movement-schema";

describe("MovementFormSchema", () => {
  const validEntry = {
    direction: "entry" as const,
    product_id: "prod-1",
    quantity: 10,
  };

  const validExit = {
    direction: "exit" as const,
    exit_type: "exit_technician" as const,
    product_id: "prod-1",
    technician_id: "tech-1",
    quantity: 5,
  };

  // ─── direction ─────────────────────────────────────────────────────
  it("accepts entry direction", () => {
    const result = MovementFormSchema.safeParse(validEntry);
    expect(result.success).toBe(true);
  });

  it("accepts exit direction", () => {
    const result = MovementFormSchema.safeParse(validExit);
    expect(result.success).toBe(true);
  });

  it("rejects invalid direction", () => {
    const result = MovementFormSchema.safeParse({ ...validEntry, direction: "transfer" });
    expect(result.success).toBe(false);
  });

  // ─── product_id ────────────────────────────────────────────────────
  it("rejects empty product_id", () => {
    const result = MovementFormSchema.safeParse({ ...validEntry, product_id: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing product_id", () => {
    const { product_id: _, ...without } = validEntry;
    const result = MovementFormSchema.safeParse(without);
    expect(result.success).toBe(false);
  });

  // ─── quantity ──────────────────────────────────────────────────────
  it("accepts quantity of 1", () => {
    const result = MovementFormSchema.safeParse({ ...validEntry, quantity: 1 });
    expect(result.success).toBe(true);
  });

  it("rejects quantity of 0", () => {
    const result = MovementFormSchema.safeParse({ ...validEntry, quantity: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative quantity", () => {
    const result = MovementFormSchema.safeParse({ ...validEntry, quantity: -5 });
    expect(result.success).toBe(false);
  });

  // ─── exit_type ─────────────────────────────────────────────────────
  it("accepts valid exit_type values", () => {
    for (const type of ["exit_technician", "exit_anonymous", "exit_loss"]) {
      const result = MovementFormSchema.safeParse({ ...validExit, exit_type: type });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid exit_type", () => {
    const result = MovementFormSchema.safeParse({ ...validExit, exit_type: "exit_other" });
    expect(result.success).toBe(false);
  });

  // ─── optional fields ──────────────────────────────────────────────
  it("accepts optional notes", () => {
    const result = MovementFormSchema.safeParse({ ...validEntry, notes: "Restock urgent" });
    expect(result.success).toBe(true);
  });

  it("accepts optional technician_id", () => {
    const result = MovementFormSchema.safeParse({ ...validEntry, technician_id: "tech-1" });
    expect(result.success).toBe(true);
  });
});
