import { describe, it, expect } from "vitest";
import { parseProductQr } from "./qr";

describe("parseProductQr", () => {
  // ─── Legacy pattern ────────────────────────────────────────────────
  it("parses legacy smpr:// format", () => {
    expect(parseProductQr("smpr://product/abc-123")).toBe("abc-123");
  });

  it("parses legacy format with UUID", () => {
    expect(parseProductQr("smpr://product/550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000"
    );
  });

  // ─── URL pattern (stock — legacy) ──────────────────────────────────
  it("parses stock URL format (https)", () => {
    expect(parseProductQr("https://istock-app.space/stock?product=abc-123")).toBe("abc-123");
  });

  it("parses stock URL format (http)", () => {
    expect(parseProductQr("http://istock-app.space/stock?product=abc-123")).toBe("abc-123");
  });

  // ─── URL pattern (actions — new) ──────────────────────────────────
  it("parses actions URL format (https)", () => {
    expect(parseProductQr("https://istock-app.space/actions?product=abc-123")).toBe("abc-123");
  });

  it("parses actions URL format (http)", () => {
    expect(parseProductQr("http://istock-app.space/actions?product=abc-123")).toBe("abc-123");
  });

  it("parses URL with additional query params after product", () => {
    expect(parseProductQr("https://istock-app.space/actions?product=abc-123&foo=bar")).toBe(
      "abc-123"
    );
  });

  // ─── Invalid inputs ───────────────────────────────────────────────
  it("returns null for empty string", () => {
    expect(parseProductQr("")).toBeNull();
  });

  it("returns null for random text", () => {
    expect(parseProductQr("hello world")).toBeNull();
  });

  it("returns null for wrong protocol", () => {
    expect(parseProductQr("ftp://product/abc-123")).toBeNull();
  });

  it("returns null for malformed legacy URL", () => {
    expect(parseProductQr("smpr://products/abc-123")).toBeNull();
  });

  it("returns null for URL without product param", () => {
    expect(parseProductQr("https://istock-app.space/actions")).toBeNull();
  });
});
