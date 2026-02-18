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
  it("creates movement via RPC on success", async () => {
    const movementData = {
      id: "mv-1",
      product_id: "prod-1",
      quantity: 10,
      movement_type: "entry",
    };

    mockClient._setResult({ data: movementData, error: null });

    const result = await createEntry("org-1", "prod-1", 10, "Restock");

    expect(result).toEqual(movementData);
    expect(mockClient.rpc).toHaveBeenCalledWith("create_stock_entry", {
      p_organization_id: "org-1",
      p_product_id: "prod-1",
      p_quantity: 10,
      p_notes: "Restock",
    });
  });

  it("passes null notes when none provided", async () => {
    mockClient._setResult({ data: { id: "mv-2" }, error: null });

    await createEntry("org-1", "prod-1", 5);

    expect(mockClient.rpc).toHaveBeenCalledWith("create_stock_entry", {
      p_organization_id: "org-1",
      p_product_id: "prod-1",
      p_quantity: 5,
      p_notes: null,
    });
  });

  it("throws on RPC error", async () => {
    mockClient._setResult({ data: null, error: { message: "RPC failed" } });

    await expect(createEntry("org-1", "prod-1", 10)).rejects.toThrow(
      "Erreur lors de la création du mouvement: RPC failed"
    );
  });
});

// ─── createExit ─────────────────────────────────────────────────────
describe("createExit", () => {
  it("creates exit movement via RPC", async () => {
    const movementData = { id: "mv-3", quantity: 5, movement_type: "exit_anonymous" };
    mockClient._setResult({ data: movementData, error: null });

    const result = await createExit("org-1", "prod-1", 5, "exit_anonymous");

    expect(result).toEqual(movementData);
    expect(mockClient.rpc).toHaveBeenCalledWith("create_stock_exit", {
      p_organization_id: "org-1",
      p_product_id: "prod-1",
      p_quantity: 5,
      p_type: "exit_anonymous",
      p_technician_id: null,
      p_notes: null,
    });
  });

  it("passes technician_id and notes when provided", async () => {
    const movementData = { id: "mv-4", quantity: 3, movement_type: "exit_technician" };
    mockClient._setResult({ data: movementData, error: null });

    const result = await createExit("org-1", "prod-1", 3, "exit_technician", "tech-1", "Field job");

    expect(result).toEqual(movementData);
    expect(mockClient.rpc).toHaveBeenCalledWith("create_stock_exit", {
      p_organization_id: "org-1",
      p_product_id: "prod-1",
      p_quantity: 3,
      p_type: "exit_technician",
      p_technician_id: "tech-1",
      p_notes: "Field job",
    });
  });

  it("throws on RPC error", async () => {
    mockClient._setResult({ data: null, error: { message: "Stock insuffisant" } });

    await expect(
      createExit("org-1", "prod-1", 10, "exit_anonymous")
    ).rejects.toThrow("Erreur lors de la création du mouvement: Stock insuffisant");
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
