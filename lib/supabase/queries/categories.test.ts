import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/lib/__mocks__/supabase";

// Mock the client module
const mockClient = createMockSupabaseClient();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

import {
  getCategories,
  getCategoriesTree,
  deleteCategory,
} from "./categories";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── getCategoriesTree ──────────────────────────────────────────────
describe("getCategoriesTree", () => {
  it("builds a 2-level tree from flat data", async () => {
    const flat = [
      { id: "root", name: "Peintures", parent_id: null, organization_id: "org-1", created_at: "2024-01-01" },
      { id: "child", name: "Acrylique", parent_id: "root", organization_id: "org-1", created_at: "2024-01-02" },
    ];
    mockClient._setResult({ data: flat, error: null });

    const tree = await getCategoriesTree("org-1");

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("root");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children![0].id).toBe("child");
  });

  it("places orphan categories (invalid parent_id) at root level", async () => {
    const flat = [
      { id: "orphan", name: "Orphan", parent_id: "nonexistent", organization_id: "org-1", created_at: "2024-01-01" },
    ];
    mockClient._setResult({ data: flat, error: null });

    const tree = await getCategoriesTree("org-1");

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("orphan");
  });

  it("returns empty array when no categories exist", async () => {
    mockClient._setResult({ data: [], error: null });

    const tree = await getCategoriesTree("org-1");
    expect(tree).toHaveLength(0);
  });

  it("handles deeply nested categories", async () => {
    const flat = [
      { id: "l0", name: "Level 0", parent_id: null, organization_id: "org-1", created_at: "2024-01-01" },
      { id: "l1", name: "Level 1", parent_id: "l0", organization_id: "org-1", created_at: "2024-01-02" },
      { id: "l2", name: "Level 2", parent_id: "l1", organization_id: "org-1", created_at: "2024-01-03" },
    ];
    mockClient._setResult({ data: flat, error: null });

    const tree = await getCategoriesTree("org-1");

    expect(tree).toHaveLength(1);
    expect(tree[0].children![0].children![0].id).toBe("l2");
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "DB error" } });
    await expect(getCategories("org-1")).rejects.toThrow("DB error");
  });
});

// ─── deleteCategory ─────────────────────────────────────────────────
describe("deleteCategory", () => {
  it("deletes a category with no children", async () => {
    // First call: check children -> empty
    // Second call: delete
    let callCount = 0;
    const originalThen = mockClient.then;

    mockClient.then = (resolve: any, reject?: any) => {
      callCount++;
      if (callCount === 1) {
        // Check for children
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      }
      // Delete
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    };

    await deleteCategory("cat-1");
    // If we get here without throwing, the delete succeeded
    expect(mockClient.from).toHaveBeenCalled();

    // Restore
    mockClient.then = originalThen;
  });

  it("throws if category has children", async () => {
    let callCount = 0;
    const originalThen = mockClient.then;

    mockClient.then = (resolve: any, reject?: any) => {
      callCount++;
      if (callCount === 1) {
        // Children found
        return Promise.resolve({ data: [{ id: "child-1" }], error: null }).then(resolve, reject);
      }
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    };

    await expect(deleteCategory("cat-1")).rejects.toThrow(
      "Impossible de supprimer une catégorie qui contient des sous-catégories"
    );

    mockClient.then = originalThen;
  });

  it("throws on Supabase error during delete", async () => {
    let callCount = 0;
    const originalThen = mockClient.then;

    mockClient.then = (resolve: any, reject?: any) => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      }
      return Promise.resolve({ data: null, error: { message: "Delete failed" } }).then(resolve, reject);
    };

    await expect(deleteCategory("cat-1")).rejects.toThrow("Delete failed");

    mockClient.then = originalThen;
  });
});
