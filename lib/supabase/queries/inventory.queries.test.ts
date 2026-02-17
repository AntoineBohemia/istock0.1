import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/lib/__mocks__/supabase";

const mockClient = createMockSupabaseClient();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

import { restockTechnician } from "./inventory";

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
