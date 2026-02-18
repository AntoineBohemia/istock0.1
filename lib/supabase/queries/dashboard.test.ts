import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/lib/__mocks__/supabase";

const mockClient = createMockSupabaseClient();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

vi.mock("@/lib/utils/stock", () => ({
  calculateStockScore: vi.fn((current: number, min: number, max: number) => {
    if (max <= 0) return 0;
    return Math.round((current / max) * 100);
  }),
}));

import {
  getCategoryBreakdown,
  getGlobalBreakdown,
  getDashboardStats,
  getProductsNeedingRestock,
  getTechniciansNeedingRestock,
  getRecentMovements,
  getGlobalStockEvolution,
  getProductStockEvolution,
  getCategoryStockEvolution,
  getTechnicianStats,
  type BreakdownItem,
} from "./dashboard";

beforeEach(() => {
  vi.clearAllMocks();
});

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

// ─── getDashboardStats ──────────────────────────────────────────────
describe("getDashboardStats", () => {
  it("computes all stats correctly", async () => {
    mockClient._setResult({
      data: {
        totalStock: 55,
        totalValue: 600,
        monthlyEntries: 20,
        monthlyExits: 8,
        totalProducts: 2,
        lowStockCount: 1,
      },
      error: null,
    });

    const result = await getDashboardStats();

    expect(result.totalStock).toBe(55);
    expect(result.totalValue).toBe(600);
    expect(result.monthlyEntries).toBe(20);
    expect(result.monthlyExits).toBe(8);
    expect(result.totalProducts).toBe(2);
    expect(result.lowStockCount).toBe(1);
  });

  it("filters by organizationId", async () => {
    mockClient._setResult({
      data: {
        totalStock: 0,
        totalValue: 0,
        monthlyEntries: 0,
        monthlyExits: 0,
        totalProducts: 0,
        lowStockCount: 0,
      },
      error: null,
    });

    await getDashboardStats("org-1");

    expect(mockClient.rpc).toHaveBeenCalledWith("get_dashboard_stats", {
      p_organization_id: "org-1",
    });
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Stats error" } });

    await expect(getDashboardStats()).rejects.toThrow("Stats error");
  });
});

// ─── getProductsNeedingRestock ───────────────────────────────────────
describe("getProductsNeedingRestock", () => {
  it("returns products with score < 30 sorted by score", async () => {
    const products = [
      { id: "p1", name: "Low", sku: null, image_url: null, stock_current: 5, stock_min: 10, stock_max: 100 },
      { id: "p2", name: "OK", sku: null, image_url: null, stock_current: 80, stock_min: 10, stock_max: 100 },
      { id: "p3", name: "Very Low", sku: null, image_url: null, stock_current: 2, stock_min: 10, stock_max: 100 },
    ];
    mockClient._setResult({ data: products, error: null });

    const result = await getProductsNeedingRestock();

    // p1: score=5, p3: score=2, p2: score=80 (filtered out)
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Very Low");
    expect(result[1].name).toBe("Low");
  });

  it("respects limit parameter", async () => {
    const products = [
      { id: "p1", name: "Low1", sku: null, image_url: null, stock_current: 1, stock_min: 10, stock_max: 100 },
      { id: "p2", name: "Low2", sku: null, image_url: null, stock_current: 2, stock_min: 10, stock_max: 100 },
      { id: "p3", name: "Low3", sku: null, image_url: null, stock_current: 3, stock_min: 10, stock_max: 100 },
    ];
    mockClient._setResult({ data: products, error: null });

    const result = await getProductsNeedingRestock(2);

    expect(result).toHaveLength(2);
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Products error" } });

    await expect(getProductsNeedingRestock()).rejects.toThrow("Products error");
  });
});

// ─── getTechniciansNeedingRestock ────────────────────────────────────
describe("getTechniciansNeedingRestock", () => {
  it("returns technicians with no recent restock", async () => {
    const originalThen = mockClient.then;
    let callCount = 0;

    mockClient.then = (resolve: any, reject?: any) => {
      callCount++;
      if (callCount === 1) {
        // Technicians query
        return Promise.resolve({
          data: [
            { id: "tech-1", first_name: "Jean", last_name: "Dupont", technician_inventory: [{ id: "i1" }] },
            { id: "tech-2", first_name: "Marie", last_name: "Martin", technician_inventory: [] },
          ],
          error: null,
        }).then(resolve, reject);
      }
      if (callCount === 2) {
        // History query - no recent restocks
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      }
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    };

    try {
      const result = await getTechniciansNeedingRestock(7);

      expect(result).toHaveLength(2);
    } finally {
      mockClient.then = originalThen;
    }
  });

  it("returns empty when all recently restocked", async () => {
    const originalThen = mockClient.then;
    let callCount = 0;
    const recentDate = new Date().toISOString();

    mockClient.then = (resolve: any, reject?: any) => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          data: [{ id: "tech-1", first_name: "Jean", last_name: "Dupont", technician_inventory: [] }],
          error: null,
        }).then(resolve, reject);
      }
      if (callCount === 2) {
        return Promise.resolve({
          data: [{ technician_id: "tech-1", created_at: recentDate }],
          error: null,
        }).then(resolve, reject);
      }
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    };

    try {
      const result = await getTechniciansNeedingRestock(7);

      expect(result).toEqual([]);
    } finally {
      mockClient.then = originalThen;
    }
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Technicians error" } });

    await expect(getTechniciansNeedingRestock()).rejects.toThrow("Technicians error");
  });
});

// ─── getRecentMovements ──────────────────────────────────────────────
describe("getRecentMovements", () => {
  it("returns movements with product and technician relations", async () => {
    const movements = [
      {
        id: "mv-1",
        quantity: 5,
        movement_type: "entry",
        created_at: "2024-06-15",
        notes: null,
        product: { id: "p1", name: "Widget", sku: null, image_url: null, price: 10 },
        technician: null,
      },
    ];
    mockClient._setResult({ data: movements, error: null });

    const result = await getRecentMovements();

    expect(result).toHaveLength(1);
    expect(result[0].product.name).toBe("Widget");
  });

  it("respects limit", async () => {
    mockClient._setResult({ data: [], error: null });

    await getRecentMovements(5);

    expect(mockClient.limit).toHaveBeenCalledWith(5);
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Movements error" } });

    await expect(getRecentMovements()).rejects.toThrow("Movements error");
  });
});

// ─── getGlobalStockEvolution ─────────────────────────────────────────
describe("getGlobalStockEvolution", () => {
  it("returns monthly data with correct stock calculations", async () => {
    const originalThen = mockClient.then;
    let callCount = 0;

    mockClient.then = (resolve: any, reject?: any) => {
      callCount++;
      if (callCount === 1) {
        // Movements query
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      }
      if (callCount === 2) {
        // Products query (current total stock)
        return Promise.resolve({
          data: [{ stock_current: 100 }],
          error: null,
        }).then(resolve, reject);
      }
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    };

    try {
      const result = await getGlobalStockEvolution(6);

      expect(result).toHaveLength(6);
      expect(result[result.length - 1].totalStock).toBe(100);
    } finally {
      mockClient.then = originalThen;
    }
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Evolution error" } });

    await expect(getGlobalStockEvolution()).rejects.toThrow("Evolution error");
  });
});

// ─── getProductStockEvolution ────────────────────────────────────────
describe("getProductStockEvolution", () => {
  it("returns monthly data for a specific product", async () => {
    const originalThen = mockClient.then;
    let callCount = 0;

    mockClient.then = (resolve: any, reject?: any) => {
      callCount++;
      if (callCount === 1) {
        // Product current stock
        return Promise.resolve({
          data: { stock_current: 50 },
          error: null,
        }).then(resolve, reject);
      }
      if (callCount === 2) {
        // Movements query
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      }
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    };

    try {
      const result = await getProductStockEvolution("prod-1", 6);

      expect(result).toHaveLength(6);
      expect(result[result.length - 1].totalStock).toBe(50);
    } finally {
      mockClient.then = originalThen;
    }
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Product evolution error" } });

    await expect(getProductStockEvolution("prod-1")).rejects.toThrow("Product evolution error");
  });
});

// ─── getCategoryStockEvolution ───────────────────────────────────────
describe("getCategoryStockEvolution", () => {
  it("returns monthly data for products in category", async () => {
    const originalThen = mockClient.then;
    let callCount = 0;

    mockClient.then = (resolve: any, reject?: any) => {
      callCount++;
      if (callCount === 1) {
        // Products in category
        return Promise.resolve({
          data: [
            { id: "p1", stock_current: 30 },
            { id: "p2", stock_current: 20 },
          ],
          error: null,
        }).then(resolve, reject);
      }
      if (callCount === 2) {
        // Movements query
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      }
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    };

    try {
      const result = await getCategoryStockEvolution("cat-1", 6);

      expect(result).toHaveLength(6);
      expect(result[result.length - 1].totalStock).toBe(50);
    } finally {
      mockClient.then = originalThen;
    }
  });

  it("returns empty data when no products in category", async () => {
    mockClient._setResult({ data: [], error: null });

    const result = await getCategoryStockEvolution("cat-empty", 6);

    expect(result).toHaveLength(6);
    result.forEach((d) => {
      expect(d.totalStock).toBe(0);
      expect(d.entries).toBe(0);
      expect(d.exits).toBe(0);
    });
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Category evolution error" } });

    await expect(getCategoryStockEvolution("cat-1")).rejects.toThrow("Category evolution error");
  });
});

// ─── getTechnicianStats ──────────────────────────────────────────────
describe("getTechnicianStats", () => {
  it("returns correct counts (good/low stock, needing restock)", async () => {
    const originalThen = mockClient.then;
    let callCount = 0;

    mockClient.then = (resolve: any, reject?: any) => {
      callCount++;
      if (callCount === 1) {
        // Technicians with inventory
        return Promise.resolve({
          data: [
            {
              id: "tech-1",
              technician_inventory: [
                { quantity: 80, product: { stock_max: 100 } },
              ],
            },
            {
              id: "tech-2",
              technician_inventory: [
                { quantity: 10, product: { stock_max: 100 } },
              ],
            },
            {
              id: "tech-3",
              technician_inventory: [],
            },
          ],
          error: null,
        }).then(resolve, reject);
      }
      if (callCount === 2) {
        // getTechniciansNeedingRestock -> technicians query
        return Promise.resolve({
          data: [
            { id: "tech-1", first_name: "A", last_name: "B", technician_inventory: [] },
            { id: "tech-2", first_name: "C", last_name: "D", technician_inventory: [] },
            { id: "tech-3", first_name: "E", last_name: "F", technician_inventory: [] },
          ],
          error: null,
        }).then(resolve, reject);
      }
      if (callCount === 3) {
        // getTechniciansNeedingRestock -> history query
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      }
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    };

    try {
      const result = await getTechnicianStats();

      expect(result.total).toBe(3);
      // tech-1: score=80 (>=50 -> good), tech-2: score=10 (<50 -> low), tech-3: empty (low)
      expect(result.withGoodStock).toBe(1);
      expect(result.withLowStock).toBe(2);
      expect(result.needingRestock).toBe(3);
    } finally {
      mockClient.then = originalThen;
    }
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Tech stats error" } });

    await expect(getTechnicianStats()).rejects.toThrow("Tech stats error");
  });
});
