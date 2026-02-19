import { describe, it, expect } from "vitest";
import { queryKeys } from "./query-keys";

// ─── Helper ─────────────────────────────────────────────────────────
function isPrefix(prefix: readonly unknown[], full: readonly unknown[]) {
  if (prefix.length > full.length) return false;
  return prefix.every((v, i) => v === full[i]);
}

// ─── products ───────────────────────────────────────────────────────
describe("queryKeys.products", () => {
  it("all returns ['products']", () => {
    expect(queryKeys.products.all).toEqual(["products"]);
  });

  it("lists() starts with all prefix", () => {
    expect(isPrefix(queryKeys.products.all, queryKeys.products.lists())).toBe(true);
  });

  it("lists() returns ['products', 'list']", () => {
    expect(queryKeys.products.lists()).toEqual(["products", "list"]);
  });

  it("list(filters) starts with lists() prefix", () => {
    const filters = { organizationId: "org-1" };
    expect(isPrefix(queryKeys.products.lists(), queryKeys.products.list(filters))).toBe(true);
  });

  it("list(filters) includes the filters object", () => {
    const filters = { organizationId: "org-1", search: "vis" };
    const key = queryKeys.products.list(filters);
    expect(key).toContain(filters);
  });

  it("details() starts with all prefix", () => {
    expect(isPrefix(queryKeys.products.all, queryKeys.products.details())).toBe(true);
  });

  it("detail(id) starts with details() prefix", () => {
    expect(isPrefix(queryKeys.products.details(), queryKeys.products.detail("p1"))).toBe(true);
  });

  it("detail(id) includes the id", () => {
    expect(queryKeys.products.detail("p1")).toContain("p1");
  });

  it("stats(orgId) starts with all prefix and includes orgId", () => {
    const key = queryKeys.products.stats("org-1");
    expect(isPrefix(queryKeys.products.all, key)).toBe(true);
    expect(key).toContain("org-1");
  });
});

// ─── categories ─────────────────────────────────────────────────────
describe("queryKeys.categories", () => {
  it("all returns ['categories']", () => {
    expect(queryKeys.categories.all).toEqual(["categories"]);
  });

  it("list(orgId) starts with all prefix and includes orgId", () => {
    const key = queryKeys.categories.list("org-1");
    expect(isPrefix(queryKeys.categories.all, key)).toBe(true);
    expect(key).toContain("org-1");
  });

  it("tree(orgId) starts with all prefix", () => {
    expect(isPrefix(queryKeys.categories.all, queryKeys.categories.tree("org-1"))).toBe(true);
  });

  it("detail(id) starts with all prefix and includes id", () => {
    const key = queryKeys.categories.detail("cat-1");
    expect(isPrefix(queryKeys.categories.all, key)).toBe(true);
    expect(key).toContain("cat-1");
  });
});

// ─── movements ──────────────────────────────────────────────────────
describe("queryKeys.movements", () => {
  it("all returns ['movements']", () => {
    expect(queryKeys.movements.all).toEqual(["movements"]);
  });

  it("lists() starts with all prefix", () => {
    expect(isPrefix(queryKeys.movements.all, queryKeys.movements.lists())).toBe(true);
  });

  it("list(filters) starts with lists() prefix", () => {
    const filters = { organizationId: "org-1" };
    expect(isPrefix(queryKeys.movements.lists(), queryKeys.movements.list(filters))).toBe(true);
  });

  it("byProduct(productId) starts with all prefix and includes productId", () => {
    const key = queryKeys.movements.byProduct("p1");
    expect(isPrefix(queryKeys.movements.all, key)).toBe(true);
    expect(key).toContain("p1");
  });

  it("stats(productId, months) starts with all prefix", () => {
    const key = queryKeys.movements.stats("p1", 6);
    expect(isPrefix(queryKeys.movements.all, key)).toBe(true);
    expect(key).toContain("p1");
    expect(key).toContain(6);
  });

  it("summary(orgId) starts with all prefix and includes orgId (Fix 6)", () => {
    const key = queryKeys.movements.summary("org-1");
    expect(isPrefix(queryKeys.movements.all, key)).toBe(true);
    expect(key).toContain("org-1");
  });

  it("summary() without orgId still starts with all prefix", () => {
    const key = queryKeys.movements.summary();
    expect(isPrefix(queryKeys.movements.all, key)).toBe(true);
    expect(key).toContain("summary");
  });
});

// ─── technicians ────────────────────────────────────────────────────
describe("queryKeys.technicians", () => {
  it("all returns ['technicians']", () => {
    expect(queryKeys.technicians.all).toEqual(["technicians"]);
  });

  it("list(orgId) starts with all prefix", () => {
    expect(isPrefix(queryKeys.technicians.all, queryKeys.technicians.list("org-1"))).toBe(true);
  });

  it("detail(id) starts with all prefix and includes id", () => {
    const key = queryKeys.technicians.detail("t1");
    expect(isPrefix(queryKeys.technicians.all, key)).toBe(true);
    expect(key).toContain("t1");
  });

  it("stats(orgId) starts with all prefix and includes orgId", () => {
    const key = queryKeys.technicians.stats("org-1");
    expect(isPrefix(queryKeys.technicians.all, key)).toBe(true);
    expect(key).toContain("org-1");
  });

  it("inventory(techId) starts with all prefix", () => {
    const key = queryKeys.technicians.inventory("t1");
    expect(isPrefix(queryKeys.technicians.all, key)).toBe(true);
    expect(key).toContain("t1");
  });

  it("history(techId) starts with all prefix", () => {
    const key = queryKeys.technicians.history("t1");
    expect(isPrefix(queryKeys.technicians.all, key)).toBe(true);
    expect(key).toContain("t1");
  });

  it("movements(techId) starts with all prefix", () => {
    const key = queryKeys.technicians.movements("t1");
    expect(isPrefix(queryKeys.technicians.all, key)).toBe(true);
    expect(key).toContain("t1");
  });
});

// ─── dashboard ──────────────────────────────────────────────────────
describe("queryKeys.dashboard", () => {
  it("all returns ['dashboard']", () => {
    expect(queryKeys.dashboard.all).toEqual(["dashboard"]);
  });

  it("recentMovements(orgId, limit) includes both params", () => {
    const key = queryKeys.dashboard.recentMovements("org-1", 10);
    expect(isPrefix(queryKeys.dashboard.all, key)).toBe(true);
    expect(key).toContain("org-1");
    expect(key).toContain(10);
  });

  it("stockEvolution(orgId, months) includes both params", () => {
    const key = queryKeys.dashboard.stockEvolution("org-1", 6);
    expect(key).toContain("org-1");
    expect(key).toContain(6);
  });

  it("productEvolution(productId, months) includes both params", () => {
    const key = queryKeys.dashboard.productEvolution("p1", 3);
    expect(key).toContain("p1");
    expect(key).toContain(3);
  });

  it("categoryEvolution(categoryId, months) includes both params", () => {
    const key = queryKeys.dashboard.categoryEvolution("cat-1", 6);
    expect(key).toContain("cat-1");
    expect(key).toContain(6);
  });

  it("productsNeedingRestock(orgId) includes orgId", () => {
    expect(queryKeys.dashboard.productsNeedingRestock("org-1")).toContain("org-1");
  });

});

// ─── organizations ──────────────────────────────────────────────────
describe("queryKeys.organizations", () => {
  it("all returns ['organizations']", () => {
    expect(queryKeys.organizations.all).toEqual(["organizations"]);
  });

  it("list() starts with all prefix", () => {
    expect(isPrefix(queryKeys.organizations.all, queryKeys.organizations.list())).toBe(true);
  });

  it("members(orgId) starts with all prefix and includes orgId", () => {
    const key = queryKeys.organizations.members("org-1");
    expect(isPrefix(queryKeys.organizations.all, key)).toBe(true);
    expect(key).toContain("org-1");
  });

  it("invitations(orgId) starts with all prefix and includes orgId", () => {
    const key = queryKeys.organizations.invitations("org-1");
    expect(isPrefix(queryKeys.organizations.all, key)).toBe(true);
    expect(key).toContain("org-1");
  });
});

// ─── inventory ──────────────────────────────────────────────────────
describe("queryKeys.inventory", () => {
  it("all returns ['inventory']", () => {
    expect(queryKeys.inventory.all).toEqual(["inventory"]);
  });

  it("availableProducts(orgId) starts with all prefix and includes orgId", () => {
    const key = queryKeys.inventory.availableProducts("org-1");
    expect(isPrefix(queryKeys.inventory.all, key)).toBe(true);
    expect(key).toContain("org-1");
  });
});

// ─── No namespace collisions ────────────────────────────────────────
describe("namespace isolation", () => {
  it("all top-level prefixes are unique", () => {
    const allPrefixes = [
      queryKeys.products.all[0],
      queryKeys.categories.all[0],
      queryKeys.movements.all[0],
      queryKeys.technicians.all[0],
      queryKeys.dashboard.all[0],
      queryKeys.organizations.all[0],
      queryKeys.inventory.all[0],
    ];
    const unique = new Set(allPrefixes);
    expect(unique.size).toBe(allPrefixes.length);
  });
});
