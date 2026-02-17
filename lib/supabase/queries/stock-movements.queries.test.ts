import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/lib/__mocks__/supabase";

const mockClient = createMockSupabaseClient();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

import {
  createEntry,
  createExit,
  getStockMovements,
  getProductMovements,
  getProductMovementStats,
  getMovementsSummary,
} from "./stock-movements";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── createEntry ────────────────────────────────────────────────────
describe("createEntry", () => {
  it("throws for quantity <= 0", async () => {
    await expect(createEntry("org-1", "prod-1", 0)).rejects.toThrow(
      "La quantité doit être positive"
    );
    await expect(createEntry("org-1", "prod-1", -5)).rejects.toThrow(
      "La quantité doit être positive"
    );
  });

  it("creates movement and increments stock on success", async () => {
    const movementData = {
      id: "mv-1",
      product_id: "prod-1",
      quantity: 10,
      movement_type: "entry",
    };

    let callCount = 0;
    const originalThen = mockClient.then;
    mockClient.then = (resolve: any, reject?: any) => {
      callCount++;
      if (callCount === 1) {
        // Insert movement
        return Promise.resolve({ data: movementData, error: null }).then(resolve, reject);
      }
      // RPC increment_stock
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    };

    const result = await createEntry("org-1", "prod-1", 10, "Restock");
    expect(result).toEqual(movementData);

    mockClient.then = originalThen;
  });

  it("falls back when RPC fails", async () => {
    const movementData = { id: "mv-2", quantity: 5 };
    let callCount = 0;
    const originalThen = mockClient.then;

    mockClient.then = (resolve: any, reject?: any) => {
      callCount++;
      if (callCount === 1) {
        // Insert movement succeeds
        return Promise.resolve({ data: movementData, error: null }).then(resolve, reject);
      }
      if (callCount === 2) {
        // RPC fails
        return Promise.resolve({ data: null, error: { message: "RPC not found" } }).then(resolve, reject);
      }
      if (callCount === 3) {
        // Fallback update fails
        return Promise.resolve({ data: null, error: { message: "Fallback failed" } }).then(resolve, reject);
      }
      if (callCount === 4) {
        // Read current stock
        return Promise.resolve({ data: { stock_current: 20 }, error: null }).then(resolve, reject);
      }
      // Final update
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    };

    const result = await createEntry("org-1", "prod-1", 5);
    expect(result).toEqual(movementData);

    mockClient.then = originalThen;
  });
});

// ─── createExit ─────────────────────────────────────────────────────
describe("createExit", () => {
  it("throws for quantity <= 0", async () => {
    await expect(
      createExit("org-1", "prod-1", 0, "exit_anonymous")
    ).rejects.toThrow("La quantité doit être positive");
  });

  it("throws when stock is insufficient", async () => {
    mockClient._setResult({
      data: { stock_current: 3, name: "Widget" },
      error: null,
    });

    await expect(
      createExit("org-1", "prod-1", 10, "exit_anonymous")
    ).rejects.toThrow("Stock insuffisant");
  });

  it("throws when product not found", async () => {
    mockClient._setResult({ data: null, error: { code: "PGRST116", message: "Not found" } });

    await expect(
      createExit("org-1", "prod-1", 5, "exit_anonymous")
    ).rejects.toThrow("Produit non trouvé");
  });

  it("requires technician_id for exit_technician type", async () => {
    let callCount = 0;
    const originalThen = mockClient.then;

    mockClient.then = (resolve: any, reject?: any) => {
      callCount++;
      if (callCount === 1) {
        // Product check
        return Promise.resolve({ data: { stock_current: 100, name: "Widget" }, error: null }).then(resolve, reject);
      }
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    };

    await expect(
      createExit("org-1", "prod-1", 5, "exit_technician")
    ).rejects.toThrow("Un technicien doit être sélectionné");

    mockClient.then = originalThen;
  });

  it("creates exit movement and decrements stock", async () => {
    const movementData = { id: "mv-3", quantity: 5, movement_type: "exit_anonymous" };
    let callCount = 0;
    const originalThen = mockClient.then;

    mockClient.then = (resolve: any, reject?: any) => {
      callCount++;
      if (callCount === 1) {
        // Product check
        return Promise.resolve({ data: { stock_current: 20, name: "Widget" }, error: null }).then(resolve, reject);
      }
      if (callCount === 2) {
        // Insert movement
        return Promise.resolve({ data: movementData, error: null }).then(resolve, reject);
      }
      // Decrement stock
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    };

    const result = await createExit("org-1", "prod-1", 5, "exit_anonymous");
    expect(result).toEqual(movementData);

    mockClient.then = originalThen;
  });

  it("updates technician inventory for exit_technician", async () => {
    const movementData = { id: "mv-4", quantity: 3, movement_type: "exit_technician" };
    let callCount = 0;
    const originalThen = mockClient.then;

    mockClient.then = (resolve: any, reject?: any) => {
      callCount++;
      if (callCount === 1) {
        // Product check
        return Promise.resolve({ data: { stock_current: 20, name: "Widget" }, error: null }).then(resolve, reject);
      }
      if (callCount === 2) {
        // Insert movement
        return Promise.resolve({ data: movementData, error: null }).then(resolve, reject);
      }
      if (callCount === 3) {
        // Decrement stock
        return Promise.resolve({ data: null, error: null }).then(resolve, reject);
      }
      if (callCount === 4) {
        // Check existing inventory
        return Promise.resolve({ data: { id: "inv-1", quantity: 5 }, error: null }).then(resolve, reject);
      }
      // Update inventory
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    };

    const result = await createExit("org-1", "prod-1", 3, "exit_technician", "tech-1");
    expect(result).toEqual(movementData);

    mockClient.then = originalThen;
  });
});

// ─── getStockMovements ───────────────────────────────────────────────
describe("getStockMovements", () => {
  it("returns paginated results with default filters", async () => {
    const movements = [{ id: "mv-1", quantity: 10, movement_type: "entry" }];
    mockClient._setResult({ data: movements, error: null, count: 1 });

    const result = await getStockMovements();

    expect(result.movements).toEqual(movements);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.totalPages).toBe(1);
  });

  it("applies all filters (orgId, productId, technicianId, movementType, dates)", async () => {
    mockClient._setResult({ data: [], error: null, count: 0 });

    await getStockMovements({
      organizationId: "org-1",
      productId: "prod-1",
      technicianId: "tech-1",
      movementType: "entry",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });

    expect(mockClient.eq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(mockClient.eq).toHaveBeenCalledWith("product_id", "prod-1");
    expect(mockClient.eq).toHaveBeenCalledWith("technician_id", "tech-1");
    expect(mockClient.eq).toHaveBeenCalledWith("movement_type", "entry");
    expect(mockClient.gte).toHaveBeenCalledWith("created_at", "2024-01-01");
    expect(mockClient.lte).toHaveBeenCalledWith("created_at", "2024-12-31");
  });

  it("calculates pagination correctly", async () => {
    mockClient._setResult({ data: [], error: null, count: 50 });

    const result = await getStockMovements({ page: 3, pageSize: 10 });

    expect(mockClient.range).toHaveBeenCalledWith(20, 29);
    expect(result.totalPages).toBe(5);
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Query error" } });

    await expect(getStockMovements()).rejects.toThrow("Query error");
  });
});

// ─── getProductMovements ─────────────────────────────────────────────
describe("getProductMovements", () => {
  it("returns movements for a product", async () => {
    const movements = [{ id: "mv-1", product_id: "prod-1", quantity: 5 }];
    mockClient._setResult({ data: movements, error: null });

    const result = await getProductMovements("prod-1");

    expect(result).toEqual(movements);
    expect(mockClient.eq).toHaveBeenCalledWith("product_id", "prod-1");
  });

  it("applies limit", async () => {
    mockClient._setResult({ data: [], error: null });

    await getProductMovements("prod-1", 10);

    expect(mockClient.limit).toHaveBeenCalledWith(10);
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Movements error" } });

    await expect(getProductMovements("prod-1")).rejects.toThrow("Movements error");
  });
});

// ─── getProductMovementStats ─────────────────────────────────────────
describe("getProductMovementStats", () => {
  it("groups movements by day and calculates balance", async () => {
    const movements = [
      { quantity: 10, movement_type: "entry", created_at: "2024-06-15T10:00:00Z" },
      { quantity: 3, movement_type: "exit_technician", created_at: "2024-06-15T14:00:00Z" },
      { quantity: 5, movement_type: "entry", created_at: "2024-06-16T10:00:00Z" },
    ];
    mockClient._setResult({ data: movements, error: null });

    const result = await getProductMovementStats("prod-1");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ date: "2024-06-15", entries: 10, exits: 3, balance: 7 });
    expect(result[1]).toEqual({ date: "2024-06-16", entries: 5, exits: 0, balance: 5 });
  });

  it("returns empty array when no movements", async () => {
    mockClient._setResult({ data: [], error: null });

    const result = await getProductMovementStats("prod-1");

    expect(result).toEqual([]);
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Stats error" } });

    await expect(getProductMovementStats("prod-1")).rejects.toThrow("Stats error");
  });
});

// ─── getMovementsSummary ─────────────────────────────────────────────
describe("getMovementsSummary", () => {
  it("calculates total entries and exits over 30 days", async () => {
    const movements = [
      { quantity: 10, movement_type: "entry" },
      { quantity: 5, movement_type: "entry" },
      { quantity: 3, movement_type: "exit_technician" },
      { quantity: 2, movement_type: "exit_anonymous" },
    ];
    mockClient._setResult({ data: movements, error: null });

    const result = await getMovementsSummary();

    expect(result.totalEntries).toBe(15);
    expect(result.totalExits).toBe(5);
    expect(result.recentMovements).toBe(4);
  });

  it("returns zeros when no movements", async () => {
    mockClient._setResult({ data: [], error: null });

    const result = await getMovementsSummary();

    expect(result).toEqual({ totalEntries: 0, totalExits: 0, recentMovements: 0 });
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Summary error" } });

    await expect(getMovementsSummary()).rejects.toThrow("Summary error");
  });
});
