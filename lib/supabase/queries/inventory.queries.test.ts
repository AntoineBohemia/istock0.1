import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/lib/__mocks__/supabase";

const mockClient = createMockSupabaseClient();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

import { restockTechnician, getAvailableProductsForRestock, addToTechnicianInventory } from "./inventory";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("restockTechnician", () => {
  it("calls RPC with correctly formatted items and returns result", async () => {
    const rpcResult = {
      success: true,
      items_count: 3,
      previous_items_count: 1,
    };
    mockClient._setResult({ data: rpcResult, error: null });

    const result = await restockTechnician("tech-1", [
      { productId: "p1", quantity: 5 },
      { productId: "p2", quantity: 3 },
    ]);

    expect(mockClient.rpc).toHaveBeenCalledWith("restock_technician", {
      p_technician_id: "tech-1",
      p_items: [
        { product_id: "p1", quantity: 5 },
        { product_id: "p2", quantity: 3 },
      ],
    });
    expect(result).toEqual(rpcResult);
  });

  it("throws specific error for insufficient stock", async () => {
    mockClient._setResult({
      data: null,
      error: { message: "Stock insuffisant pour produit X" },
    });

    await expect(
      restockTechnician("tech-1", [{ productId: "p1", quantity: 999 }])
    ).rejects.toThrow("Stock insuffisant pour un ou plusieurs produits");
  });

  it("throws generic error for other RPC failures", async () => {
    mockClient._setResult({
      data: null,
      error: { message: "Connection timeout" },
    });

    await expect(
      restockTechnician("tech-1", [{ productId: "p1", quantity: 1 }])
    ).rejects.toThrow("Erreur lors du restock: Connection timeout");
  });
});

// ─── getAvailableProductsForRestock ──────────────────────────────────
describe("getAvailableProductsForRestock", () => {
  it("returns products with stock > 0", async () => {
    const products = [
      { id: "p1", name: "Widget", sku: "W-1", image_url: null, stock_current: 10, stock_max: 100 },
    ];
    mockClient._setResult({ data: products, error: null });

    const result = await getAvailableProductsForRestock();

    expect(result).toEqual(products);
    expect(mockClient.gt).toHaveBeenCalledWith("stock_current", 0);
  });

  it("returns empty array when no products available", async () => {
    mockClient._setResult({ data: [], error: null });

    const result = await getAvailableProductsForRestock();

    expect(result).toEqual([]);
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Products error" } });

    await expect(getAvailableProductsForRestock()).rejects.toThrow("Products error");
  });
});

// ─── addToTechnicianInventory ──────────────────────────────────────
describe("addToTechnicianInventory", () => {
  it("adds new items to empty inventory", async () => {
    // Sequence: 1) read inventory, 2) insert history, 3) check product stock,
    // 4) insert inventory, 5) insert movement, 6) update product stock
    mockClient._setResults([
      { data: [], error: null },                                              // 1. current inventory (empty)
      { data: null, error: null },                                            // 2. insert history snapshot
      { data: { stock_current: 10, name: "Widget" }, error: null },           // 3. check product stock
      { data: null, error: null },                                            // 4. insert into technician_inventory
      { data: null, error: null },                                            // 5. insert stock_movement
      { data: null, error: null },                                            // 6. update product stock_current
    ]);

    const result = await addToTechnicianInventory("tech-1", [
      { productId: "p1", quantity: 5 },
    ]);

    expect(result).toEqual({
      success: true,
      items_count: 1,
      previous_items_count: 0,
    });

    // Verify history was saved
    expect(mockClient.from).toHaveBeenCalledWith("technician_inventory_history");
    // Verify inventory insert
    expect(mockClient.insert).toHaveBeenCalledWith({
      technician_id: "tech-1",
      product_id: "p1",
      quantity: 5,
    });
    // Verify movement was created
    expect(mockClient.insert).toHaveBeenCalledWith({
      product_id: "p1",
      quantity: 5,
      movement_type: "exit_technician",
      technician_id: "tech-1",
    });
  });

  it("adds quantities to existing products", async () => {
    const existingInventory = [
      { id: "inv-1", product_id: "p1", quantity: 3, product: { name: "Widget", sku: "W-1" } },
    ];

    // Sequence: 1) read inventory, 2) insert history, 3) check product stock,
    // 4) update inventory quantity, 5) insert movement, 6) update product stock
    mockClient._setResults([
      { data: existingInventory, error: null },                               // 1. current inventory
      { data: null, error: null },                                            // 2. insert history
      { data: { stock_current: 10, name: "Widget" }, error: null },           // 3. check stock
      { data: null, error: null },                                            // 4. update inventory (3+5=8)
      { data: null, error: null },                                            // 5. insert movement
      { data: null, error: null },                                            // 6. update stock
    ]);

    const result = await addToTechnicianInventory("tech-1", [
      { productId: "p1", quantity: 5 },
    ]);

    expect(result).toEqual({
      success: true,
      items_count: 1,
      previous_items_count: 1,
    });

    // Verify update was called with combined quantity (3 + 5 = 8)
    expect(mockClient.update).toHaveBeenCalledWith({ quantity: 8 });
  });

  it("throws on insufficient stock", async () => {
    mockClient._setResults([
      { data: [], error: null },                                              // 1. current inventory
      { data: null, error: null },                                            // 2. insert history
      { data: { stock_current: 2, name: "Widget" }, error: null },            // 3. product has only 2
    ]);

    await expect(
      addToTechnicianInventory("tech-1", [{ productId: "p1", quantity: 5 }])
    ).rejects.toThrow('Stock insuffisant pour "Widget"');
  });

  it("throws on Supabase error", async () => {
    mockClient._setResults([
      { data: null, error: { message: "DB connection lost" } },               // 1. inventory read fails
    ]);

    await expect(
      addToTechnicianInventory("tech-1", [{ productId: "p1", quantity: 1 }])
    ).rejects.toThrow("Erreur lors de la lecture de l'inventaire: DB connection lost");
  });
});
