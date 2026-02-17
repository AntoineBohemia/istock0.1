import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/lib/__mocks__/supabase";

const mockClient = createMockSupabaseClient();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

import { createEntry, createExit } from "./stock-movements";

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
