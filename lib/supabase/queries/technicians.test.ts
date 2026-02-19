import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/lib/__mocks__/supabase";

const mockClient = createMockSupabaseClient();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

import {
  getTechnicians,
  getTechniciansStats,
  getTechnician,
  createTechnician,
  updateTechnician,
  archiveTechnician,
  getTechnicianInventoryHistory,
  getTechnicianStockMovements,
} from "./technicians";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── getTechnicians ─────────────────────────────────────────────────
describe("getTechnicians", () => {
  it("returns technicians with inventory_count and last_restock_at from RPC", async () => {
    mockClient._setResult({
      data: [
        {
          id: "tech-1",
          first_name: "Jean",
          last_name: "Dupont",
          email: "j@d.com",
          phone: null,
          city: null,
          organization_id: "org-1",
          created_at: "2024-01-01",
          inventory: [],
          inventory_count: 15,
          last_restock_at: "2024-06-15T10:00:00Z",
        },
      ],
      error: null,
    });

    const result = await getTechnicians("org-1");

    expect(mockClient.rpc).toHaveBeenCalledWith("get_technicians_with_stats", {
      p_organization_id: "org-1",
    });
    expect(result).toHaveLength(1);
    expect(result[0].inventory_count).toBe(15);
    expect(result[0].last_restock_at).toBe("2024-06-15T10:00:00Z");
  });

  it("returns empty array when no technicians exist", async () => {
    mockClient._setResult({ data: [], error: null });

    const result = await getTechnicians("org-1");
    expect(result).toEqual([]);
  });

  it("returns 0 inventory_count for technicians without inventory", async () => {
    mockClient._setResult({
      data: [
        {
          id: "tech-1",
          first_name: "A",
          last_name: "B",
          email: "a@b.com",
          phone: null,
          city: null,
          organization_id: "org-1",
          created_at: "2024-01-01",
          inventory: [],
          inventory_count: 0,
          last_restock_at: null,
        },
      ],
      error: null,
    });

    const result = await getTechnicians("org-1");
    expect(result[0].inventory_count).toBe(0);
    expect(result[0].last_restock_at).toBeNull();
  });

  it("passes undefined when no organizationId is provided", async () => {
    mockClient._setResult({ data: [], error: null });

    await getTechnicians();

    expect(mockClient.rpc).toHaveBeenCalledWith("get_technicians_with_stats", {
      p_organization_id: undefined,
    });
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "DB error" } });
    await expect(getTechnicians("org-1")).rejects.toThrow("DB error");
  });
});

// ─── getTechniciansStats ────────────────────────────────────────────
describe("getTechniciansStats", () => {
  it("returns zero stats when no technicians exist", async () => {
    mockClient._setResult({ data: [], error: null });

    const stats = await getTechniciansStats("org-1");
    expect(stats).toEqual({
      totalTechnicians: 0,
      emptyInventory: 0,
      totalItems: 0,
      recentRestocks: 0,
    });
  });

  it("counts empty inventories and total items", async () => {
    const originalThen = mockClient.then;
    let callCount = 0;

    mockClient.then = (resolve: any, reject?: any) => {
      callCount++;
      if (callCount === 1) {
        // Get technicians
        return Promise.resolve({
          data: [{ id: "t1" }, { id: "t2" }, { id: "t3" }],
          error: null,
        }).then(resolve, reject);
      }
      if (callCount === 2) {
        // Get inventory
        return Promise.resolve({
          data: [
            { technician_id: "t1", quantity: 10 },
            { technician_id: "t1", quantity: 5 },
            // t2 has no inventory, t3 has no inventory
          ],
          error: null,
        }).then(resolve, reject);
      }
      if (callCount === 3) {
        // Recent restocks
        return Promise.resolve({
          data: [{ technician_id: "t1" }],
          error: null,
        }).then(resolve, reject);
      }
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    };

    try {
      const stats = await getTechniciansStats("org-1");
      expect(stats.totalTechnicians).toBe(3);
      expect(stats.emptyInventory).toBe(2); // t2 and t3
      expect(stats.totalItems).toBe(15);
      expect(stats.recentRestocks).toBe(1);
    } finally {
      mockClient.then = originalThen;
    }
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Query failed" } });
    await expect(getTechniciansStats("org-1")).rejects.toThrow("Query failed");
  });
});

// ─── createTechnician ────────────────────────────────────────────────
describe("createTechnician", () => {
  it("creates a technician with all fields", async () => {
    const techData = {
      id: "tech-1",
      first_name: "Jean",
      last_name: "Dupont",
      email: "jean@test.com",
      phone: "0612345678",
      city: "Paris",
      organization_id: "org-1",
      created_at: "2024-01-01",
    };
    mockClient._setResult({ data: techData, error: null });

    const result = await createTechnician({
      organization_id: "org-1",
      first_name: "Jean",
      last_name: "Dupont",
      email: "jean@test.com",
      phone: "0612345678",
      city: "Paris",
    });

    expect(mockClient.insert).toHaveBeenCalledWith({
      organization_id: "org-1",
      first_name: "Jean",
      last_name: "Dupont",
      email: "jean@test.com",
      phone: "0612345678",
      city: "Paris",
    });
    expect(result).toEqual(techData);
  });

  it("sets phone and city to null when not provided", async () => {
    mockClient._setResult({ data: { id: "tech-1" }, error: null });

    await createTechnician({
      organization_id: "org-1",
      first_name: "Jean",
      last_name: "Dupont",
      email: "jean@test.com",
    });

    expect(mockClient.insert).toHaveBeenCalledWith({
      organization_id: "org-1",
      first_name: "Jean",
      last_name: "Dupont",
      email: "jean@test.com",
      phone: null,
      city: null,
    });
  });

  it("throws specific error for duplicate email (23505)", async () => {
    mockClient._setResult({ data: null, error: { code: "23505", message: "duplicate" } });

    await expect(
      createTechnician({
        organization_id: "org-1",
        first_name: "Jean",
        last_name: "Dupont",
        email: "jean@test.com",
      })
    ).rejects.toThrow("Un technicien avec cet email existe déjà");
  });

  it("throws generic error on other failures", async () => {
    mockClient._setResult({ data: null, error: { code: "42P01", message: "Table error" } });

    await expect(
      createTechnician({
        organization_id: "org-1",
        first_name: "Jean",
        last_name: "Dupont",
        email: "jean@test.com",
      })
    ).rejects.toThrow("Table error");
  });
});

// ─── updateTechnician ────────────────────────────────────────────────
describe("updateTechnician", () => {
  it("updates only provided fields", async () => {
    const updated = { id: "tech-1", first_name: "Pierre", last_name: "Dupont", email: "jean@test.com" };
    mockClient._setResult({ data: updated, error: null });

    await updateTechnician("tech-1", { first_name: "Pierre" });

    expect(mockClient.update).toHaveBeenCalledWith({ first_name: "Pierre" });
  });

  it("throws specific error for duplicate email (23505)", async () => {
    mockClient._setResult({ data: null, error: { code: "23505", message: "duplicate" } });

    await expect(
      updateTechnician("tech-1", { email: "existing@test.com" })
    ).rejects.toThrow("Un technicien avec cet email existe déjà");
  });

  it("throws generic error", async () => {
    mockClient._setResult({ data: null, error: { code: "42P01", message: "Update error" } });

    await expect(updateTechnician("tech-1", { first_name: "X" })).rejects.toThrow("Update error");
  });
});

// ─── archiveTechnician ───────────────────────────────────────────────
describe("archiveTechnician", () => {
  it("archives a technician by id (soft-delete via update)", async () => {
    mockClient._setResult({ data: null, error: null });

    await archiveTechnician("tech-1");

    expect(mockClient.update).toHaveBeenCalledWith(
      expect.objectContaining({ archived_at: expect.any(String) })
    );
    expect(mockClient.eq).toHaveBeenCalledWith("id", "tech-1");
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Archive failed" } });

    await expect(archiveTechnician("tech-1")).rejects.toThrow("Archive failed");
  });
});

// ─── getTechnician ───────────────────────────────────────────────────
describe("getTechnician", () => {
  it("returns technician with inventory and last_restock_at", async () => {
    const originalThen = mockClient.then;
    let callCount = 0;

    mockClient.then = (resolve: any, reject?: any) => {
      callCount++;
      if (callCount === 1) {
        // Technician query
        return Promise.resolve({
          data: { id: "tech-1", first_name: "Jean", last_name: "Dupont", email: "j@d.com", phone: null, city: null, organization_id: "org-1", created_at: "2024-01-01" },
          error: null,
        }).then(resolve, reject);
      }
      if (callCount === 2) {
        // Inventory query
        return Promise.resolve({
          data: [
            { id: "inv-1", technician_id: "tech-1", product_id: "p1", quantity: 10, assigned_at: "2024-01-01", product: { id: "p1", name: "Widget", sku: null, image_url: null, stock_max: 100 } },
          ],
          error: null,
        }).then(resolve, reject);
      }
      if (callCount === 3) {
        // Last restock query
        return Promise.resolve({
          data: { created_at: "2024-06-15T10:00:00Z" },
          error: null,
        }).then(resolve, reject);
      }
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    };

    try {
      const result = await getTechnician("tech-1");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("tech-1");
      expect(result!.inventory).toHaveLength(1);
      expect(result!.inventory_count).toBe(10);
      expect(result!.last_restock_at).toBe("2024-06-15T10:00:00Z");
    } finally {
      mockClient.then = originalThen;
    }
  });

  it("returns null when not found (PGRST116)", async () => {
    mockClient._setResult({ data: null, error: { code: "PGRST116", message: "No rows" } });

    const result = await getTechnician("nonexistent");

    expect(result).toBeNull();
  });

  it("throws on other errors", async () => {
    mockClient._setResult({ data: null, error: { code: "42P01", message: "Table error" } });

    await expect(getTechnician("tech-1")).rejects.toThrow("Table error");
  });
});

// ─── getTechnicianInventoryHistory ───────────────────────────────────
describe("getTechnicianInventoryHistory", () => {
  it("returns history entries sorted by date", async () => {
    const history = [
      { id: "h-1", technician_id: "tech-1", snapshot: { items: [], total_items: 5 }, created_at: "2024-06-15" },
      { id: "h-2", technician_id: "tech-1", snapshot: { items: [], total_items: 3 }, created_at: "2024-06-10" },
    ];
    mockClient._setResult({ data: history, error: null });

    const result = await getTechnicianInventoryHistory("tech-1");

    expect(result).toEqual(history);
    expect(mockClient.eq).toHaveBeenCalledWith("technician_id", "tech-1");
    expect(mockClient.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("returns empty array when no history", async () => {
    mockClient._setResult({ data: [], error: null });

    const result = await getTechnicianInventoryHistory("tech-1");

    expect(result).toEqual([]);
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "History error" } });

    await expect(getTechnicianInventoryHistory("tech-1")).rejects.toThrow("History error");
  });
});

// ─── getTechnicianStockMovements ─────────────────────────────────────
describe("getTechnicianStockMovements", () => {
  it("returns movements with product relation", async () => {
    const movements = [
      {
        id: "mv-1",
        product_id: "p1",
        quantity: 5,
        movement_type: "exit_technician",
        notes: null,
        created_at: "2024-06-15",
        product: [{ id: "p1", name: "Widget", sku: null, image_url: null }],
      },
    ];
    mockClient._setResult({ data: movements, error: null });

    const result = await getTechnicianStockMovements("tech-1");

    expect(result).toHaveLength(1);
    expect(result[0].product).toEqual({ id: "p1", name: "Widget", sku: null, image_url: null });
    expect(mockClient.eq).toHaveBeenCalledWith("technician_id", "tech-1");
    expect(mockClient.eq).toHaveBeenCalledWith("movement_type", "exit_technician");
  });

  it("returns empty array when no movements", async () => {
    mockClient._setResult({ data: [], error: null });

    const result = await getTechnicianStockMovements("tech-1");

    expect(result).toEqual([]);
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Movements error" } });

    await expect(getTechnicianStockMovements("tech-1")).rejects.toThrow("Movements error");
  });
});
