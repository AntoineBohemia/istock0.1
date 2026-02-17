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
  createCategory,
  updateCategory,
  getParentCategories,
  getSubCategories,
  getCategoryById,
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

// ─── createCategory ──────────────────────────────────────────────────
describe("createCategory", () => {
  it("creates a category with parent_id null by default", async () => {
    const created = { id: "cat-1", name: "Peintures", parent_id: null, organization_id: "org-1", created_at: "2024-01-01" };
    mockClient._setResult({ data: created, error: null });

    const result = await createCategory("org-1", "Peintures");

    expect(mockClient.insert).toHaveBeenCalledWith({
      organization_id: "org-1",
      name: "Peintures",
      parent_id: null,
    });
    expect(result).toEqual(created);
  });

  it("creates a sub-category with parent_id", async () => {
    const created = { id: "cat-2", name: "Acrylique", parent_id: "cat-1", organization_id: "org-1", created_at: "2024-01-01" };
    mockClient._setResult({ data: created, error: null });

    const result = await createCategory("org-1", "Acrylique", "cat-1");

    expect(mockClient.insert).toHaveBeenCalledWith({
      organization_id: "org-1",
      name: "Acrylique",
      parent_id: "cat-1",
    });
    expect(result).toEqual(created);
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Insert failed" } });
    await expect(createCategory("org-1", "Test")).rejects.toThrow("Insert failed");
  });
});

// ─── updateCategory ──────────────────────────────────────────────────
describe("updateCategory", () => {
  it("updates name and parent_id", async () => {
    const updated = { id: "cat-1", name: "Renamed", parent_id: "cat-2", organization_id: "org-1", created_at: "2024-01-01" };
    mockClient._setResult({ data: updated, error: null });

    const result = await updateCategory("cat-1", "Renamed", "cat-2");

    expect(mockClient.update).toHaveBeenCalledWith({
      name: "Renamed",
      parent_id: "cat-2",
    });
    expect(result).toEqual(updated);
  });

  it("does not include parent_id when undefined", async () => {
    const updated = { id: "cat-1", name: "Renamed", parent_id: null, organization_id: "org-1", created_at: "2024-01-01" };
    mockClient._setResult({ data: updated, error: null });

    await updateCategory("cat-1", "Renamed");

    expect(mockClient.update).toHaveBeenCalledWith({
      name: "Renamed",
      parent_id: undefined,
    });
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Update failed" } });
    await expect(updateCategory("cat-1", "Test")).rejects.toThrow("Update failed");
  });
});

// ─── getParentCategories ─────────────────────────────────────────────
describe("getParentCategories", () => {
  it("returns only root categories (parent_id is null)", async () => {
    const roots = [
      { id: "root-1", name: "Peintures", parent_id: null, organization_id: "org-1", created_at: "2024-01-01" },
    ];
    mockClient._setResult({ data: roots, error: null });

    const result = await getParentCategories();

    expect(mockClient.is).toHaveBeenCalledWith("parent_id", null);
    expect(result).toEqual(roots);
  });

  it("filters by organizationId when provided", async () => {
    mockClient._setResult({ data: [], error: null });

    await getParentCategories("org-1");

    expect(mockClient.eq).toHaveBeenCalledWith("organization_id", "org-1");
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Query failed" } });
    await expect(getParentCategories()).rejects.toThrow("Query failed");
  });
});

// ─── getSubCategories ────────────────────────────────────────────────
describe("getSubCategories", () => {
  it("returns children of a parent", async () => {
    const children = [
      { id: "sub-1", name: "Acrylique", parent_id: "root-1", organization_id: "org-1", created_at: "2024-01-01" },
    ];
    mockClient._setResult({ data: children, error: null });

    const result = await getSubCategories("root-1");

    expect(mockClient.eq).toHaveBeenCalledWith("parent_id", "root-1");
    expect(result).toEqual(children);
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Query failed" } });
    await expect(getSubCategories("root-1")).rejects.toThrow("Query failed");
  });
});

// ─── getCategoryById ─────────────────────────────────────────────────
describe("getCategoryById", () => {
  it("returns a category by id", async () => {
    const cat = { id: "cat-1", name: "Peintures", parent_id: null, organization_id: "org-1", created_at: "2024-01-01" };
    mockClient._setResult({ data: cat, error: null });

    const result = await getCategoryById("cat-1");

    expect(mockClient.eq).toHaveBeenCalledWith("id", "cat-1");
    expect(result).toEqual(cat);
  });

  it("returns null when not found (PGRST116)", async () => {
    mockClient._setResult({ data: null, error: { code: "PGRST116", message: "No rows found" } });

    const result = await getCategoryById("nonexistent");

    expect(result).toBeNull();
  });

  it("throws on other errors", async () => {
    mockClient._setResult({ data: null, error: { code: "42P01", message: "Table not found" } });
    await expect(getCategoryById("cat-1")).rejects.toThrow("Table not found");
  });
});
