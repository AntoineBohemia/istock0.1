import { describe, it, expect } from "vitest";
import {
  getCategoryBreakdown,
  getGlobalBreakdown,
  type BreakdownItem,
} from "./dashboard";

// ─── getCategoryBreakdown ───────────────────────────────────────────
describe("getCategoryBreakdown", () => {
  const allCategories = [
    { id: "root", name: "Peintures", parent_id: null },
    { id: "sub1", name: "Acrylique", parent_id: "root" },
    { id: "sub2", name: "Glycéro", parent_id: "root" },
  ];

  const allProducts = [
    { id: "p1", name: "Blanc mat", category_id: "sub1", stock_current: 10 },
    { id: "p2", name: "Blanc satiné", category_id: "sub1", stock_current: 5 },
    { id: "p3", name: "Noir brillant", category_id: "sub2", stock_current: 8 },
    { id: "p4", name: "Rouge", category_id: "root", stock_current: 3 },
  ];

  it("builds breakdown with sub-categories and direct products", async () => {
    const result = await getCategoryBreakdown("root", allCategories, allProducts);

    // Should have 2 sub-categories + 1 direct product
    const categories = result.filter((i) => i.type === "category");
    const products = result.filter((i) => i.type === "product");

    expect(categories).toHaveLength(2);
    expect(products).toHaveLength(1);
    expect(products[0].name).toBe("Rouge");
  });

  it("calculates recursive stock totals for sub-categories", async () => {
    const result = await getCategoryBreakdown("root", allCategories, allProducts);

    const acrylique = result.find((i) => i.name === "Acrylique");
    expect(acrylique?.stock).toBe(15); // 10 + 5

    const glycero = result.find((i) => i.name === "Glycéro");
    expect(glycero?.stock).toBe(8);
  });

  it("returns empty array for category with no content", async () => {
    const result = await getCategoryBreakdown("nonexistent", allCategories, allProducts);
    expect(result).toHaveLength(0);
  });

  it("sets correct depth values", async () => {
    const result = await getCategoryBreakdown("root", allCategories, allProducts);
    for (const item of result) {
      expect(item.depth).toBe(0);
    }
  });

  it("includes children for sub-categories with products", async () => {
    const result = await getCategoryBreakdown("root", allCategories, allProducts);
    const acrylique = result.find((i) => i.name === "Acrylique");
    expect(acrylique?.children).toHaveLength(2);
  });
});

// ─── getGlobalBreakdown ─────────────────────────────────────────────
describe("getGlobalBreakdown", () => {
  const categoriesTree = [
    { id: "root", name: "Peintures", parent_id: null },
  ];

  const allCategories = [
    { id: "root", name: "Peintures", parent_id: null },
    { id: "sub1", name: "Acrylique", parent_id: "root" },
  ];

  const allProducts = [
    { id: "p1", name: "Blanc", category_id: "sub1", stock_current: 10 },
    { id: "p2", name: "Vis", category_id: null, stock_current: 50 },
  ];

  it("includes root categories and uncategorized products", async () => {
    const result = await getGlobalBreakdown(categoriesTree, allCategories, allProducts);

    // 1 root category + 1 uncategorized product
    expect(result).toHaveLength(2);

    const rootCat = result.find((i) => i.type === "category");
    expect(rootCat?.name).toBe("Peintures");
    expect(rootCat?.stock).toBe(10);

    const uncategorized = result.find((i) => i.type === "product");
    expect(uncategorized?.name).toBe("Vis");
    expect(uncategorized?.stock).toBe(50);
  });

  it("sets depth 0 for root items", async () => {
    const result = await getGlobalBreakdown(categoriesTree, allCategories, allProducts);
    for (const item of result) {
      expect(item.depth).toBe(0);
    }
  });

  it("handles empty data", async () => {
    const result = await getGlobalBreakdown([], [], []);
    expect(result).toHaveLength(0);
  });

  it("handles products with null stock_current", async () => {
    const products = [
      { id: "p1", name: "NullStock", category_id: null, stock_current: 0 },
    ];
    const result = await getGlobalBreakdown([], [], products);
    expect(result[0].stock).toBe(0);
  });
});
