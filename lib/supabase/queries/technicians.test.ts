import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/lib/__mocks__/supabase";

const mockClient = createMockSupabaseClient();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

import { getTechnicians, getTechniciansStats } from "./technicians";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── getTechnicians ─────────────────────────────────────────────────
describe("getTechnicians", () => {
  it("enriches technicians with inventory_count and last_restock_at", async () => {
    let callCount = 0;
    const originalThen = mockClient.then;

    mockClient.then = (resolve: any, reject?: any) => {
      callCount++;
      if (callCount === 1) {
        // Technicians query
        return Promise.resolve({
          data: [
            { id: "tech-1", first_name: "Jean", last_name: "Dupont", email: "j@d.com", phone: null, city: null, organization_id: "org-1", created_at: "2024-01-01" },
          ],
          error: null,
        }).then(resolve, reject);
      }
      if (callCount === 2) {
        // Inventory query
        return Promise.resolve({
          data: [
            { technician_id: "tech-1", quantity: 10 },
            { technician_id: "tech-1", quantity: 5 },
          ],
          error: null,
        }).then(resolve, reject);
      }
      if (callCount === 3) {
        // History query
        return Promise.resolve({
          data: [
            { technician_id: "tech-1", created_at: "2024-06-15T10:00:00Z" },
          ],
          error: null,
        }).then(resolve, reject);
      }
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    };

    const result = await getTechnicians("org-1");

    expect(result).toHaveLength(1);
    expect(result[0].inventory_count).toBe(15); // 10 + 5
    expect(result[0].last_restock_at).toBe("2024-06-15T10:00:00Z");

    mockClient.then = originalThen;
  });

  it("returns empty array when no technicians exist", async () => {
    mockClient._setResult({ data: [], error: null });

    const result = await getTechnicians("org-1");
    expect(result).toEqual([]);
  });

  it("returns 0 inventory_count for technicians without inventory", async () => {
    let callCount = 0;
    const originalThen = mockClient.then;

    mockClient.then = (resolve: any, reject?: any) => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          data: [{ id: "tech-1", first_name: "A", last_name: "B", email: "a@b.com", phone: null, city: null, organization_id: "org-1", created_at: "2024-01-01" }],
          error: null,
        }).then(resolve, reject);
      }
      if (callCount === 2) {
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      }
      return Promise.resolve({ data: [], error: null }).then(resolve, reject);
    };

    const result = await getTechnicians("org-1");
    expect(result[0].inventory_count).toBe(0);
    expect(result[0].last_restock_at).toBeNull();

    mockClient.then = originalThen;
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
    let callCount = 0;
    const originalThen = mockClient.then;

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

    const stats = await getTechniciansStats("org-1");
    expect(stats.totalTechnicians).toBe(3);
    expect(stats.emptyInventory).toBe(2); // t2 and t3
    expect(stats.totalItems).toBe(15);
    expect(stats.recentRestocks).toBe(1);

    mockClient.then = originalThen;
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Query failed" } });
    await expect(getTechniciansStats("org-1")).rejects.toThrow("Query failed");
  });
});
