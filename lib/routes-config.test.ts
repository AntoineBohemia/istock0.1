import { describe, it, expect } from "vitest";
import { filterRoutesByRole, isRoleAllowed, page_routes } from "./routes-config";

describe("isRoleAllowed", () => {
  it("returns true when allowedRoles is undefined (no restriction)", () => {
    expect(isRoleAllowed("guest", undefined)).toBe(true);
    expect(isRoleAllowed("owner", undefined)).toBe(true);
  });

  it("returns true when role is in allowedRoles", () => {
    expect(isRoleAllowed("owner", ["owner", "admin"])).toBe(true);
    expect(isRoleAllowed("admin", ["owner", "admin"])).toBe(true);
  });

  it("returns false when role is NOT in allowedRoles", () => {
    expect(isRoleAllowed("guest", ["owner", "admin", "member"])).toBe(false);
    expect(isRoleAllowed("member", ["owner"])).toBe(false);
  });

  it("returns false when role is undefined and restriction exists", () => {
    expect(isRoleAllowed(undefined, ["owner", "admin"])).toBe(false);
  });
});

describe("filterRoutesByRole — owner/admin/member", () => {
  it.each(["owner", "admin", "member"] as const)(
    "shows both Stock and Configuration sections for %s",
    (role) => {
      const filtered = filterRoutesByRole(page_routes, role);
      const titles = filtered.map((s) => s.title);
      expect(titles).toContain("Stock");
      expect(titles).toContain("Configuration");
    }
  );

  it.each(["owner", "admin", "member"] as const)(
    "shows Vue d'ensemble (dashboard) for %s",
    (role) => {
      const filtered = filterRoutesByRole(page_routes, role);
      const stockSection = filtered.find((s) => s.title === "Stock");
      expect(stockSection?.items.some((i) => i.href === "/actions")).toBe(true);
    }
  );

  it.each(["owner", "admin", "member"] as const)(
    "shows Catégories sub-item for %s",
    (role) => {
      const filtered = filterRoutesByRole(page_routes, role);
      const stockProduits = filtered
        .find((s) => s.title === "Stock")
        ?.items.find((i) => i.href === "/produits");
      expect(
        stockProduits?.items?.some((sub) => sub.href === "/parametres/categories")
      ).toBe(true);
    }
  );
});

describe("filterRoutesByRole — guest (RESTRICTED)", () => {
  const filtered = filterRoutesByRole(page_routes, "guest");

  it("does NOT show the Configuration section", () => {
    expect(filtered.some((s) => s.title === "Configuration")).toBe(false);
  });

  it("does NOT show Vue d'ensemble (dashboard)", () => {
    const items = filtered.flatMap((s) => s.items);
    expect(items.some((i) => i.href === "/actions")).toBe(false);
  });

  it("does NOT show Catégories sub-item", () => {
    const stockProduits = filtered
      .find((s) => s.title === "Stock")
      ?.items.find((i) => i.href === "/produits");
    expect(
      stockProduits?.items?.some((sub) => sub.href === "/parametres/categories")
    ).toBe(false);
  });

  it("still shows Techniciens, Stock produits, Flux de stock", () => {
    const hrefs = filtered.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).toContain("/techniciens");
    expect(hrefs).toContain("/produits");
    expect(hrefs).toContain("/mouvements");
  });

  it("only shows the Stock section (no Configuration)", () => {
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe("Stock");
  });
});

describe("filterRoutesByRole — undefined role", () => {
  it("treats undefined role as no-access for restricted items", () => {
    const filtered = filterRoutesByRole(page_routes, undefined);
    // Les items sans allowedRoles restent visibles
    const hrefs = filtered.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).toContain("/techniciens");
    // Les items restreints (/global) doivent disparaître
    expect(hrefs).not.toContain("/actions");
  });
});
