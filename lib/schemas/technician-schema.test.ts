import { describe, it, expect } from "vitest";
import { TechnicianFormSchema } from "./technician-schema";

describe("TechnicianFormSchema", () => {
  const valid = {
    first_name: "Jean",
    last_name: "Dupont",
  };

  // ─── first_name ────────────────────────────────────────────────────
  it("accepts valid first_name", () => {
    const result = TechnicianFormSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects first_name shorter than 2 chars", () => {
    const result = TechnicianFormSchema.safeParse({ ...valid, first_name: "J" });
    expect(result.success).toBe(false);
  });

  it("rejects empty first_name", () => {
    const result = TechnicianFormSchema.safeParse({ ...valid, first_name: "" });
    expect(result.success).toBe(false);
  });

  // ─── last_name ─────────────────────────────────────────────────────
  it("rejects last_name shorter than 2 chars", () => {
    const result = TechnicianFormSchema.safeParse({ ...valid, last_name: "D" });
    expect(result.success).toBe(false);
  });

  // ─── email ─────────────────────────────────────────────────────────
  it("accepts valid email", () => {
    const result = TechnicianFormSchema.safeParse({ ...valid, email: "jean@test.com" });
    expect(result.success).toBe(true);
  });

  it("accepts empty string for email (optional)", () => {
    const result = TechnicianFormSchema.safeParse({ ...valid, email: "" });
    expect(result.success).toBe(true);
  });

  it("accepts undefined email (optional)", () => {
    const result = TechnicianFormSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = TechnicianFormSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  // ─── optional fields ──────────────────────────────────────────────
  it("accepts optional phone", () => {
    const result = TechnicianFormSchema.safeParse({ ...valid, phone: "0612345678" });
    expect(result.success).toBe(true);
  });

  it("accepts optional city", () => {
    const result = TechnicianFormSchema.safeParse({ ...valid, city: "Paris" });
    expect(result.success).toBe(true);
  });
});
