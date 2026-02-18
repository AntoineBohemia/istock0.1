import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/lib/__mocks__/supabase";

const mockClient = createMockSupabaseClient();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

import {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  deleteProductImage,
  getProductsStats,
  generateSKU,
} from "./products";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── createProduct ──────────────────────────────────────────────────
describe("createProduct", () => {
  it("creates a product with default values", async () => {
    const mockProduct = {
      id: "prod-1",
      name: "Vis 3x40",
      sku: "VIS3-ABC123",
      stock_current: 0,
      stock_min: 10,
      stock_max: 100,
    };
    mockClient._setResult({ data: mockProduct, error: null });

    const result = await createProduct({
      organization_id: "org-1",
      name: "Vis 3x40",
    });

    expect(result).toEqual(mockProduct);
    expect(mockClient.insert).toHaveBeenCalled();
  });

  it("auto-generates a SKU when none provided", async () => {
    mockClient._setResult({ data: { id: "prod-2", name: "Test", sku: "TEST-123456" }, error: null });

    await createProduct({
      organization_id: "org-1",
      name: "Test Product",
    });

    // The insert should have been called with an auto-generated SKU
    const insertCall = mockClient.insert.mock.calls[0][0];
    expect(insertCall.sku).toMatch(/^TEST-/);
  });

  it("uses provided SKU when given", async () => {
    mockClient._setResult({ data: { id: "prod-3" }, error: null });

    await createProduct({
      organization_id: "org-1",
      name: "Test",
      sku: "CUSTOM-SKU",
    });

    const insertCall = mockClient.insert.mock.calls[0][0];
    expect(insertCall.sku).toBe("CUSTOM-SKU");
  });

  it("preserves price=0 correctly (uses ?? instead of ||)", async () => {
    mockClient._setResult({ data: { id: "prod-4" }, error: null });

    await createProduct({
      organization_id: "org-1",
      name: "Free Item",
      price: 0,
    });

    const insertCall = mockClient.insert.mock.calls[0][0];
    expect(insertCall.price).toBe(0);
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Insert failed" } });

    await expect(
      createProduct({ organization_id: "org-1", name: "Fail" })
    ).rejects.toThrow("Insert failed");
  });

  it("sets correct default values for all optional fields", async () => {
    mockClient._setResult({ data: { id: "prod-5" }, error: null });

    await createProduct({
      organization_id: "org-1",
      name: "Minimal Product",
    });

    const insertCall = mockClient.insert.mock.calls[0][0];
    expect(insertCall.organization_id).toBe("org-1");
    expect(insertCall.name).toBe("Minimal Product");
    expect(insertCall.description).toBeNull();
    expect(insertCall.image_url).toBeNull();
    expect(insertCall.price).toBeNull();
    expect(insertCall.stock_current).toBe(0);
    expect(insertCall.stock_min).toBe(10);
    expect(insertCall.stock_max).toBe(100);
    expect(insertCall.category_id).toBeNull();
    expect(insertCall.supplier_name).toBeNull();
    expect(insertCall.is_perishable).toBe(false);
    expect(insertCall.track_stock).toBe(true);
  });

  it("passes all provided fields to Supabase", async () => {
    mockClient._setResult({ data: { id: "prod-6" }, error: null });

    await createProduct({
      organization_id: "org-1",
      name: "Full Product",
      sku: "FULL-001",
      description: "A detailed description",
      image_url: "https://example.com/img.jpg",
      price: 49.99,
      stock_current: 25,
      stock_min: 5,
      stock_max: 200,
      category_id: "cat-1",
      supplier_name: "Fournisseur A",
      is_perishable: true,
      track_stock: false,
    });

    const insertCall = mockClient.insert.mock.calls[0][0];
    expect(insertCall.sku).toBe("FULL-001");
    expect(insertCall.description).toBe("A detailed description");
    expect(insertCall.price).toBe(49.99);
    expect(insertCall.stock_current).toBe(25);
    expect(insertCall.stock_min).toBe(5);
    expect(insertCall.stock_max).toBe(200);
    expect(insertCall.category_id).toBe("cat-1");
    expect(insertCall.supplier_name).toBe("Fournisseur A");
    expect(insertCall.is_perishable).toBe(true);
    expect(insertCall.track_stock).toBe(false);
  });

  it("preserves price=null when explicitly set", async () => {
    mockClient._setResult({ data: { id: "prod-7" }, error: null });

    await createProduct({
      organization_id: "org-1",
      name: "No Price",
      price: null,
    });

    const insertCall = mockClient.insert.mock.calls[0][0];
    expect(insertCall.price).toBeNull();
  });
});

// ─── getProductsStats ───────────────────────────────────────────────
describe("getProductsStats", () => {
  it("computes total, lowStock, outOfStock, totalValue", async () => {
    const products = [
      { stock_current: 50, stock_min: 10, price: 5 },
      { stock_current: 3, stock_min: 10, price: 20 },
      { stock_current: 0, stock_min: 5, price: 100 },
    ];
    mockClient._setResult({ data: products, error: null });

    const stats = await getProductsStats("org-1");

    expect(stats.total).toBe(3);
    expect(stats.outOfStock).toBe(1);
    expect(stats.lowStock).toBe(1); // stock=3 <= min=10 and > 0
    expect(stats.totalValue).toBe(50 * 5 + 3 * 20 + 0 * 100); // 310
  });

  it("handles empty products list", async () => {
    mockClient._setResult({ data: [], error: null });

    const stats = await getProductsStats();

    expect(stats.total).toBe(0);
    expect(stats.totalValue).toBe(0);
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Query failed" } });
    await expect(getProductsStats()).rejects.toThrow("Query failed");
  });

  it("handles products with null price in totalValue", async () => {
    const products = [
      { stock_current: 10, stock_min: 5, price: null },
      { stock_current: 5, stock_min: 5, price: 10 },
    ];
    mockClient._setResult({ data: products, error: null });

    const stats = await getProductsStats("org-1");

    expect(stats.totalValue).toBe(50); // null price treated as 0
  });

  it("counts product at exactly stock_min as lowStock", async () => {
    const products = [
      { stock_current: 10, stock_min: 10, price: 5 },
    ];
    mockClient._setResult({ data: products, error: null });

    const stats = await getProductsStats("org-1");

    expect(stats.lowStock).toBe(1); // stock_current === stock_min, > 0
    expect(stats.outOfStock).toBe(0);
  });

  it("handles null data as empty list", async () => {
    mockClient._setResult({ data: null, error: null });

    const stats = await getProductsStats();

    expect(stats.total).toBe(0);
    expect(stats.totalValue).toBe(0);
  });
});

// ─── getProducts ─────────────────────────────────────────────────────
describe("getProducts", () => {
  it("returns paginated results with defaults", async () => {
    const products = [
      { id: "p1", name: "Product 1" },
      { id: "p2", name: "Product 2" },
    ];
    mockClient._setResult({ data: products, error: null, count: 2 });

    const result = await getProducts();

    expect(result.products).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.totalPages).toBe(1);
    expect(mockClient.from).toHaveBeenCalledWith("products");
    expect(mockClient.select).toHaveBeenCalled();
  });

  it("filters by organizationId", async () => {
    mockClient._setResult({ data: [], error: null, count: 0 });

    await getProducts({ organizationId: "org-1" });

    expect(mockClient.eq).toHaveBeenCalledWith("organization_id", "org-1");
  });

  it("filters by search term", async () => {
    mockClient._setResult({ data: [], error: null, count: 0 });

    await getProducts({ search: "peinture" });

    expect(mockClient.or).toHaveBeenCalledWith(
      expect.stringContaining("peinture")
    );
  });

  it("filters by categoryId", async () => {
    mockClient._setResult({ data: [], error: null, count: 0 });

    await getProducts({ categoryId: "cat-1" });

    expect(mockClient.eq).toHaveBeenCalledWith("category_id", "cat-1");
  });

  it("filters by minPrice", async () => {
    mockClient._setResult({ data: [], error: null, count: 0 });

    await getProducts({ minPrice: 10 });

    expect(mockClient.gte).toHaveBeenCalledWith("price", 10);
  });

  it("filters by maxPrice", async () => {
    mockClient._setResult({ data: [], error: null, count: 0 });

    await getProducts({ maxPrice: 100 });

    expect(mockClient.lte).toHaveBeenCalledWith("price", 100);
  });

  it("applies pagination correctly", async () => {
    mockClient._setResult({ data: [], error: null, count: 25 });

    const result = await getProducts({ page: 3, pageSize: 5 });

    expect(mockClient.range).toHaveBeenCalledWith(10, 14);
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(5);
    expect(result.totalPages).toBe(5);
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Fetch failed" } });

    await expect(getProducts()).rejects.toThrow("Fetch failed");
  });

  it("handles null count as 0", async () => {
    mockClient._setResult({ data: [], error: null, count: null });

    const result = await getProducts();

    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });
});

// ─── getProducts — stockStatus client-side filtering ─────────────────
describe("getProducts stockStatus filtering", () => {
  const mockProducts = [
    { id: "p1", name: "Low Stock", stock_current: 3, stock_min: 10, stock_max: 100 },
    { id: "p2", name: "Normal", stock_current: 50, stock_min: 10, stock_max: 100 },
    { id: "p3", name: "High Stock", stock_current: 100, stock_min: 10, stock_max: 100 },
    { id: "p4", name: "Exact Min", stock_current: 10, stock_min: 10, stock_max: 100 },
    { id: "p5", name: "Exact Max", stock_current: 100, stock_min: 10, stock_max: 100 },
  ];

  it('stockStatus "low" keeps only products where stock_current <= stock_min', async () => {
    mockClient._setResult({ data: [...mockProducts], error: null, count: 5 });

    const result = await getProducts({ stockStatus: "low" });

    expect(result.products.map((p) => p.id)).toEqual(["p1", "p4"]);
  });

  it('stockStatus "high" keeps only products where stock_current >= stock_max', async () => {
    mockClient._setResult({ data: [...mockProducts], error: null, count: 5 });

    const result = await getProducts({ stockStatus: "high" });

    expect(result.products.map((p) => p.id)).toEqual(["p3", "p5"]);
  });

  it('stockStatus "all" returns all products without filtering', async () => {
    mockClient._setResult({ data: [...mockProducts], error: null, count: 5 });

    const result = await getProducts({ stockStatus: "all" });

    expect(result.products).toHaveLength(5);
    expect(result.total).toBe(5);
  });

  it("stockStatus undefined returns all products without filtering", async () => {
    mockClient._setResult({ data: [...mockProducts], error: null, count: 5 });

    const result = await getProducts({});

    expect(result.products).toHaveLength(5);
    expect(result.total).toBe(5);
  });

  it("total is recalculated after client-side filter", async () => {
    mockClient._setResult({ data: [...mockProducts], error: null, count: 5 });

    const result = await getProducts({ stockStatus: "low" });

    // total should be the filtered count, not the original DB count
    expect(result.total).toBe(2);
  });

  it("totalPages is recalculated after client-side filter", async () => {
    mockClient._setResult({ data: [...mockProducts], error: null, count: 5 });

    const result = await getProducts({ stockStatus: "low", pageSize: 1 });

    expect(result.totalPages).toBe(2);
  });
});

// ─── getProduct ──────────────────────────────────────────────────────
describe("getProduct", () => {
  it("returns a product by id", async () => {
    const mockProduct = { id: "prod-1", name: "Test Product" };
    mockClient._setResult({ data: mockProduct, error: null });

    const result = await getProduct("prod-1");

    expect(result).toEqual(mockProduct);
    expect(mockClient.eq).toHaveBeenCalledWith("id", "prod-1");
    expect(mockClient.single).toHaveBeenCalled();
  });

  it("returns null when product not found (PGRST116)", async () => {
    mockClient._setResult({ data: null, error: { code: "PGRST116", message: "Not found" } });

    const result = await getProduct("nonexistent");

    expect(result).toBeNull();
  });

  it("throws on other Supabase errors", async () => {
    mockClient._setResult({ data: null, error: { code: "OTHER", message: "DB error" } });

    await expect(getProduct("prod-1")).rejects.toThrow("DB error");
  });
});

// ─── updateProduct ───────────────────────────────────────────────────
describe("updateProduct", () => {
  it("updates only the provided fields", async () => {
    const mockUpdated = { id: "prod-1", name: "Updated Name", price: 29.99 };
    mockClient._setResult({ data: mockUpdated, error: null });

    const result = await updateProduct("prod-1", { name: "Updated Name", price: 29.99 });

    expect(result).toEqual(mockUpdated);
    expect(mockClient.update).toHaveBeenCalled();
    const updateCall = mockClient.update.mock.calls[0][0];
    expect(updateCall.name).toBe("Updated Name");
    expect(updateCall.price).toBe(29.99);
    expect(updateCall.updated_at).toBeDefined();
  });

  it("does not include undefined fields in the update", async () => {
    mockClient._setResult({ data: { id: "prod-1" }, error: null });

    await updateProduct("prod-1", { name: "Only Name" });

    const updateCall = mockClient.update.mock.calls[0][0];
    expect(updateCall.name).toBe("Only Name");
    expect(updateCall).not.toHaveProperty("sku");
    expect(updateCall).not.toHaveProperty("price");
    expect(updateCall).not.toHaveProperty("description");
  });

  it("always includes updated_at timestamp", async () => {
    mockClient._setResult({ data: { id: "prod-1" }, error: null });

    await updateProduct("prod-1", { name: "Test" });

    const updateCall = mockClient.update.mock.calls[0][0];
    expect(updateCall.updated_at).toBeDefined();
    expect(() => new Date(updateCall.updated_at)).not.toThrow();
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Update failed" } });

    await expect(updateProduct("prod-1", { name: "Fail" })).rejects.toThrow("Update failed");
  });

  it("updates stock values", async () => {
    mockClient._setResult({ data: { id: "prod-1" }, error: null });

    await updateProduct("prod-1", {
      stock_current: 50,
      stock_min: 10,
      stock_max: 200,
    });

    const updateCall = mockClient.update.mock.calls[0][0];
    expect(updateCall.stock_current).toBe(50);
    expect(updateCall.stock_min).toBe(10);
    expect(updateCall.stock_max).toBe(200);
  });

  it("updates boolean fields", async () => {
    mockClient._setResult({ data: { id: "prod-1" }, error: null });

    await updateProduct("prod-1", {
      is_perishable: true,
      track_stock: false,
    });

    const updateCall = mockClient.update.mock.calls[0][0];
    expect(updateCall.is_perishable).toBe(true);
    expect(updateCall.track_stock).toBe(false);
  });
});

// ─── deleteProduct ───────────────────────────────────────────────────
describe("deleteProduct", () => {
  it("deletes a product by id", async () => {
    mockClient._setResult({ data: null, error: null });

    await deleteProduct("prod-1");

    expect(mockClient.from).toHaveBeenCalledWith("products");
    expect(mockClient.delete).toHaveBeenCalled();
    expect(mockClient.eq).toHaveBeenCalledWith("id", "prod-1");
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Delete failed" } });

    await expect(deleteProduct("prod-1")).rejects.toThrow("Delete failed");
  });
});

// ─── uploadProductImage ──────────────────────────────────────────────
describe("uploadProductImage", () => {
  it("uploads a file and returns the public URL", async () => {
    const mockFile = new File(["content"], "test.jpg", { type: "image/jpeg" });

    const result = await uploadProductImage(mockFile);

    expect(result).toBe("https://example.com/img.png");
    expect(mockClient.storage.from).toHaveBeenCalledWith("product-images");
  });

  it("throws on upload error", async () => {
    const storageMock = {
      upload: vi.fn().mockResolvedValue({ error: { message: "Upload failed" } }),
      getPublicUrl: vi.fn(),
      remove: vi.fn(),
    };
    mockClient.storage.from = vi.fn(() => storageMock);

    const mockFile = new File(["content"], "test.jpg", { type: "image/jpeg" });

    await expect(uploadProductImage(mockFile)).rejects.toThrow("Upload failed");
  });
});

// ─── deleteProductImage ──────────────────────────────────────────────
describe("deleteProductImage", () => {
  it("extracts path and removes file from storage", async () => {
    const storageMock = {
      upload: vi.fn(),
      getPublicUrl: vi.fn(),
      remove: vi.fn().mockResolvedValue({ error: null }),
    };
    mockClient.storage.from = vi.fn(() => storageMock);

    await deleteProductImage("https://example.com/storage/v1/object/public/product-images/products/test.jpg");

    expect(mockClient.storage.from).toHaveBeenCalledWith("product-images");
    expect(storageMock.remove).toHaveBeenCalledWith(["products/test.jpg"]);
  });

  it("does nothing if URL does not contain product-images path", async () => {
    const storageMock = {
      upload: vi.fn(),
      getPublicUrl: vi.fn(),
      remove: vi.fn(),
    };
    mockClient.storage.from = vi.fn(() => storageMock);

    await deleteProductImage("https://example.com/other/path.jpg");

    expect(storageMock.remove).not.toHaveBeenCalled();
  });
});
