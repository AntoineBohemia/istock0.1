import { describe, it, expect } from "vitest";
import { parseProductQr } from "@/lib/utils/qr";

// ─── LEGACY_PATTERN ─────────────────────────────────────────────────
describe("QR Scanner - Legacy Pattern (smpr://)", () => {
  it("matches valid legacy format", () => {
    expect(parseProductQr("smpr://product/abc-123-def")).not.toBeNull();
  });

  it("extracts the product ID correctly", () => {
    expect(
      parseProductQr("smpr://product/550e8400-e29b-41d4-a716-446655440000")
    ).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("rejects invalid legacy format", () => {
    expect(parseProductQr("smpr://other/abc")).toBeNull();
    expect(parseProductQr("smpr://product/")).toBeNull();
    expect(parseProductQr("http://product/abc")).toBeNull();
  });

  it("rejects format with trailing slash", () => {
    expect(parseProductQr("smpr://product/abc/")).toBeNull();
  });
});

// ─── URL_PATTERN ────────────────────────────────────────────────────
describe("QR Scanner - URL Pattern (https://)", () => {
  it("matches valid HTTPS URL format", () => {
    expect(
      parseProductQr("https://istock-app.space/stock?product=abc-123")
    ).not.toBeNull();
  });

  it("extracts the product ID correctly", () => {
    expect(
      parseProductQr("https://istock-app.space/stock?product=my-product-id-42")
    ).toBe("my-product-id-42");
  });

  it("matches HTTP as well as HTTPS", () => {
    expect(
      parseProductQr("http://localhost:3000/stock?product=test-id")
    ).toBe("test-id");
  });

  it("rejects URLs without product parameter", () => {
    expect(parseProductQr("https://istock-app.space/stock")).toBeNull();
  });

  it("rejects URLs with wrong path", () => {
    expect(
      parseProductQr("https://istock-app.space/other?product=abc")
    ).toBeNull();
  });

  it("handles URLs with additional query parameters", () => {
    expect(
      parseProductQr("https://istock-app.space/stock?product=abc-123&extra=true")
    ).toBe("abc-123");
  });

  it("rejects completely invalid strings", () => {
    expect(parseProductQr("random text")).toBeNull();
    expect(parseProductQr("")).toBeNull();
  });
});
