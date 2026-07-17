import { describe, it, expect } from "vitest";
import { filterRoutesByRole, isRoleAllowed, page_routes } from "./routes-config";

describe("isRoleAllowed", () => {
  it("returns true when allowedRoles is undefined (no restriction)", () => {
    expect(isRoleAllowed("member", undefined)).toBe(true);
    expect(isRoleAllowed("owner", undefined)).toBe(true);
  });

  it("returns true when role is in allowedRoles", () => {
    expect(isRoleAllowed("owner", ["owner", "admin"])).toBe(true);
    expect(isRoleAllowed("admin", ["owner", "admin"])).toBe(true);
  });

  it("returns false when role is NOT in allowedRoles", () => {
    expect(isRoleAllowed("member", ["owner", "admin"])).toBe(false);
  });

  it("returns false when role is undefined and restriction exists", () => {
    expect(isRoleAllowed(undefined, ["owner", "admin"])).toBe(false);
  });
});

describe("filterRoutesByRole — owner/admin (full access)", () => {
  it.each(["owner", "admin"] as const)("shows all routes for %s", (role) => {
    const filtered = filterRoutesByRole(page_routes, role);
    const hrefs = filtered.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).toContain("/actions");
    expect(hrefs).toContain("/produits");
    expect(hrefs).toContain("/outillage");
    expect(hrefs).toContain("/achats");
    expect(hrefs).toContain("/techniciens");
    expect(hrefs).toContain("/mouvements");
  });
});

describe("filterRoutesByRole — member (restricted to /actions)", () => {
  const filtered = filterRoutesByRole(page_routes, "member");
  const hrefs = filtered.flatMap((s) => s.items.map((i) => i.href));

  it("shows /actions", () => {
    expect(hrefs).toContain("/actions");
  });

  it("does NOT show other routes", () => {
    expect(hrefs).not.toContain("/produits");
    expect(hrefs).not.toContain("/outillage");
    expect(hrefs).not.toContain("/achats");
    expect(hrefs).not.toContain("/techniciens");
    expect(hrefs).not.toContain("/mouvements");
  });
});

describe("filterRoutesByRole — undefined role", () => {
  it("only shows unrestricted items", () => {
    const filtered = filterRoutesByRole(page_routes, undefined);
    const hrefs = filtered.flatMap((s) => s.items.map((i) => i.href));
    // /actions has no allowedRoles restriction, so it shows
    expect(hrefs).toContain("/actions");
    // restricted routes should be hidden
    expect(hrefs).not.toContain("/produits");
  });
});
