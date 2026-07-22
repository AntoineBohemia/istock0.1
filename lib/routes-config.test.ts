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
    expect(hrefs).toContain("/produits");
    expect(hrefs).toContain("/outillage");
    expect(hrefs).toContain("/fournisseurs");
    expect(hrefs).toContain("/achats");
    expect(hrefs).toContain("/techniciens");
    expect(hrefs).toContain("/mouvements");
  });
});

describe("page_routes — /actions est un écran mobile, hors menu desktop", () => {
  it("n'expose aucune entrée vers /actions", () => {
    const hrefs = page_routes.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).not.toContain("/actions");
  });
});

describe("filterRoutesByRole — member (aucun accès au menu desktop)", () => {
  const filtered = filterRoutesByRole(page_routes, "member");
  const hrefs = filtered.flatMap((s) => s.items.map((i) => i.href));

  it("ne montre aucune route", () => {
    expect(hrefs).toHaveLength(0);
  });
});

describe("filterRoutesByRole — undefined role", () => {
  it("ne montre aucune route", () => {
    const filtered = filterRoutesByRole(page_routes, undefined);
    const hrefs = filtered.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).toHaveLength(0);
  });
});
