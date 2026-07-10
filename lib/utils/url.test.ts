import { describe, it, expect } from "vitest";
import { isInternalPath } from "./url";

describe("isInternalPath", () => {
  it("returns true for simple internal paths", () => {
    expect(isInternalPath("/actions")).toBe(true);
    expect(isInternalPath("/produits/123")).toBe(true);
    expect(isInternalPath("/techniciens/abc/edit")).toBe(true);
    expect(isInternalPath("/")).toBe(true);
  });

  it("returns true for paths with query params", () => {
    expect(isInternalPath("/login?redirectTo=/global")).toBe(true);
    expect(isInternalPath("/invite/abc?foo=bar")).toBe(true);
  });

  it("returns false for protocol-relative URLs (open redirect)", () => {
    expect(isInternalPath("//evil.com")).toBe(false);
    expect(isInternalPath("//evil.com/foo")).toBe(false);
  });

  it("returns false for absolute URLs", () => {
    expect(isInternalPath("https://evil.com")).toBe(false);
    expect(isInternalPath("http://evil.com/foo")).toBe(false);
  });

  it("returns false for javascript: protocol", () => {
    expect(isInternalPath("javascript:alert(1)")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isInternalPath("")).toBe(false);
  });

  it("returns false for relative paths without leading slash", () => {
    expect(isInternalPath("foo/bar")).toBe(false);
    expect(isInternalPath("global")).toBe(false);
  });

  it("returns false for data: URIs", () => {
    expect(isInternalPath("data:text/html,<h1>Hi</h1>")).toBe(false);
  });
});
