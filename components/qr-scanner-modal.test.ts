import { describe, it, expect } from "vitest";

// Test the regex patterns extracted from qr-scanner-modal.tsx
const LEGACY_PATTERN = /^smpr:\/\/product\/([a-zA-Z0-9-]+)$/;
const URL_PATTERN = /^https?:\/\/[^/]+\/stock\?product=([a-zA-Z0-9-]+)/;

// ─── LEGACY_PATTERN ─────────────────────────────────────────────────
describe("QR Scanner - Legacy Pattern (smpr://)", () => {
  it("matches valid legacy format", () => {
    const match = "smpr://product/abc-123-def".match(LEGACY_PATTERN);
    expect(match).not.toBeNull();
  });

  it("extracts the product ID correctly", () => {
    const match = "smpr://product/550e8400-e29b-41d4-a716-446655440000".match(
      LEGACY_PATTERN
    );
    expect(match![1]).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("rejects invalid legacy format", () => {
    expect("smpr://other/abc".match(LEGACY_PATTERN)).toBeNull();
    expect("smpr://product/".match(LEGACY_PATTERN)).toBeNull();
    expect("http://product/abc".match(LEGACY_PATTERN)).toBeNull();
  });

  it("rejects format with trailing slash", () => {
    expect("smpr://product/abc/".match(LEGACY_PATTERN)).toBeNull();
  });
});

// ─── URL_PATTERN ────────────────────────────────────────────────────
describe("QR Scanner - URL Pattern (https://)", () => {
  it("matches valid HTTPS URL format", () => {
    const match =
      "https://istock-app.space/stock?product=abc-123".match(URL_PATTERN);
    expect(match).not.toBeNull();
  });

  it("extracts the product ID correctly", () => {
    const match =
      "https://istock-app.space/stock?product=my-product-id-42".match(
        URL_PATTERN
      );
    expect(match![1]).toBe("my-product-id-42");
  });

  it("matches HTTP as well as HTTPS", () => {
    const match =
      "http://localhost:3000/stock?product=test-id".match(URL_PATTERN);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("test-id");
  });

  it("rejects URLs without product parameter", () => {
    expect(
      "https://istock-app.space/stock".match(URL_PATTERN)
    ).toBeNull();
  });

  it("rejects URLs with wrong path", () => {
    expect(
      "https://istock-app.space/other?product=abc".match(URL_PATTERN)
    ).toBeNull();
  });

  it("handles URLs with additional query parameters", () => {
    const match =
      "https://istock-app.space/stock?product=abc-123&extra=true".match(
        URL_PATTERN
      );
    expect(match).not.toBeNull();
    expect(match![1]).toBe("abc-123");
  });
});
