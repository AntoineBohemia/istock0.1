import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { createTestQueryClient, createWrapper } from "@/lib/__mocks__/test-query-utils";
import { queryKeys } from "@/lib/query-keys";

// ─── Mock mutation functions ────────────────────────────────────────
const mockCreateEntry = vi.fn().mockResolvedValue({ id: "mv-1" });
const mockCreateExit = vi.fn().mockResolvedValue({ id: "mv-2" });
const mockRestockTechnician = vi.fn().mockResolvedValue({ success: true, items_count: 2, previous_items_count: 1 });
const mockAddToTechnicianInventory = vi.fn().mockResolvedValue({ success: true, items_count: 2, previous_items_count: 1 });

vi.mock("@/lib/supabase/queries/stock-movements", () => ({
  createEntry: (...args: unknown[]) => mockCreateEntry(...args),
  createExit: (...args: unknown[]) => mockCreateExit(...args),
}));

vi.mock("@/lib/supabase/queries/inventory", () => ({
  restockTechnician: (...args: unknown[]) => mockRestockTechnician(...args),
  addToTechnicianInventory: (...args: unknown[]) => mockAddToTechnicianInventory(...args),
}));

import { useCreateStockEntry, useCreateStockExit } from "./use-stock-mutations";
import { useRestockTechnician, useAddToTechnicianInventory } from "./use-inventory-mutations";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── useCreateStockEntry ────────────────────────────────────────────
describe("useCreateStockEntry", () => {
  it("calls createEntry with correct args", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateStockEntry(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        organizationId: "org-1",
        productId: "p1",
        quantity: 10,
        notes: "Restock",
      });
    });

    expect(mockCreateEntry).toHaveBeenCalledWith("org-1", "p1", 10, "Restock");
  });

  it("performs optimistic update: +quantity on product detail", async () => {
    // Use longer gcTime so data survives cancelQueries
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false },
      },
    });
    const wrapper = createWrapper(qc);

    // Seed product data
    qc.setQueryData(queryKeys.products.detail("p1"), {
      id: "p1",
      stock_current: 50,
    });

    const { result } = renderHook(() => useCreateStockEntry(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        organizationId: "org-1",
        productId: "p1",
        quantity: 10,
      });
    });

    // After mutation settles, the optimistic update may be replaced by invalidation,
    // but onMutate should have set it. Verify the setQueryData was applied
    // by checking the final state (invalidation is a no-op since queries aren't active)
    const data = qc.getQueryData(queryKeys.products.detail("p1")) as any;
    expect(data.stock_current).toBe(60);
  });

  it("rolls back on error", async () => {
    mockCreateEntry.mockRejectedValueOnce(new Error("Server error"));
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false },
      },
    });
    const wrapper = createWrapper(qc);

    qc.setQueryData(queryKeys.products.detail("p1"), {
      id: "p1",
      stock_current: 50,
    });

    const { result } = renderHook(() => useCreateStockEntry(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          organizationId: "org-1",
          productId: "p1",
          quantity: 10,
        });
      } catch {
        // expected
      }
    });

    // Should rollback to original
    const data = qc.getQueryData(queryKeys.products.detail("p1")) as any;
    expect(data.stock_current).toBe(50);
  });

  it("invalidates products, movements, and dashboard on settle", async () => {
    const qc = createTestQueryClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const wrapper = createWrapper(qc);

    const { result } = renderHook(() => useCreateStockEntry(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        organizationId: "org-1",
        productId: "p1",
        quantity: 5,
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.products.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.movements.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.dashboard.all });
  });
});

// ─── useCreateStockExit ─────────────────────────────────────────────
describe("useCreateStockExit", () => {
  it("calls createExit with correct args", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateStockExit(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        organizationId: "org-1",
        productId: "p1",
        quantity: 3,
        type: "exit_anonymous",
      });
    });

    expect(mockCreateExit).toHaveBeenCalledWith("org-1", "p1", 3, "exit_anonymous", undefined, undefined);
  });

  it("performs optimistic update: -quantity on product detail", async () => {
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false },
      },
    });
    const wrapper = createWrapper(qc);

    qc.setQueryData(queryKeys.products.detail("p1"), {
      id: "p1",
      stock_current: 50,
    });

    const { result } = renderHook(() => useCreateStockExit(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        organizationId: "org-1",
        productId: "p1",
        quantity: 5,
        type: "exit_anonymous",
      });
    });

    const data = qc.getQueryData(queryKeys.products.detail("p1")) as any;
    expect(data.stock_current).toBe(45);
  });

  it("rolls back on error", async () => {
    mockCreateExit.mockRejectedValueOnce(new Error("Server error"));
    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false },
      },
    });
    const wrapper = createWrapper(qc);

    qc.setQueryData(queryKeys.products.detail("p1"), {
      id: "p1",
      stock_current: 50,
    });

    const { result } = renderHook(() => useCreateStockExit(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          organizationId: "org-1",
          productId: "p1",
          quantity: 5,
          type: "exit_anonymous",
        });
      } catch {
        // expected
      }
    });

    const data = qc.getQueryData(queryKeys.products.detail("p1")) as any;
    expect(data.stock_current).toBe(50);
  });

  it("invalidates products, movements, dashboard on settle", async () => {
    const qc = createTestQueryClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const wrapper = createWrapper(qc);

    const { result } = renderHook(() => useCreateStockExit(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        organizationId: "org-1",
        productId: "p1",
        quantity: 2,
        type: "exit_anonymous",
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.products.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.movements.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.dashboard.all });
  });

  it("also invalidates technicians when type is exit_technician", async () => {
    const qc = createTestQueryClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const wrapper = createWrapper(qc);

    const { result } = renderHook(() => useCreateStockExit(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        organizationId: "org-1",
        productId: "p1",
        quantity: 2,
        type: "exit_technician",
        technicianId: "t1",
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.technicians.all });
  });

  it("does NOT invalidate technicians when type is NOT exit_technician", async () => {
    const qc = createTestQueryClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const wrapper = createWrapper(qc);

    const { result } = renderHook(() => useCreateStockExit(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        organizationId: "org-1",
        productId: "p1",
        quantity: 2,
        type: "exit_anonymous",
      });
    });

    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: queryKeys.technicians.all });
  });
});

// ─── useRestockTechnician ───────────────────────────────────────────
describe("useRestockTechnician", () => {
  it("calls restockTechnician with correct args", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useRestockTechnician(), { wrapper });

    const items = [
      { productId: "p1", quantity: 5 },
      { productId: "p2", quantity: 3 },
    ];

    await act(async () => {
      await result.current.mutateAsync({ technicianId: "t1", items });
    });

    expect(mockRestockTechnician).toHaveBeenCalledWith("t1", items);
  });

  it("invalidates all required keys on settle", async () => {
    const qc = createTestQueryClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const wrapper = createWrapper(qc);

    const { result } = renderHook(() => useRestockTechnician(), { wrapper });

    const items = [{ productId: "p1", quantity: 5 }];

    await act(async () => {
      await result.current.mutateAsync({ technicianId: "t1", items });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.technicians.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.products.lists() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.products.detail("p1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.movements.lists() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.movements.summary() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.dashboard.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.inventory.all });
  });

  it("invalidates detail for each product in items", async () => {
    const qc = createTestQueryClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const wrapper = createWrapper(qc);

    const { result } = renderHook(() => useRestockTechnician(), { wrapper });

    const items = [
      { productId: "p1", quantity: 5 },
      { productId: "p2", quantity: 3 },
    ];

    await act(async () => {
      await result.current.mutateAsync({ technicianId: "t1", items });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.products.detail("p1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.products.detail("p2") });
  });
});

// ─── useAddToTechnicianInventory ────────────────────────────────────
describe("useAddToTechnicianInventory", () => {
  it("calls addToTechnicianInventory with correct args", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAddToTechnicianInventory(), { wrapper });

    const items = [{ productId: "p1", quantity: 5 }];

    await act(async () => {
      await result.current.mutateAsync({ technicianId: "t1", items });
    });

    expect(mockAddToTechnicianInventory).toHaveBeenCalledWith("t1", items);
  });

  it("invalidates all required keys on settle", async () => {
    const qc = createTestQueryClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const wrapper = createWrapper(qc);

    const { result } = renderHook(() => useAddToTechnicianInventory(), { wrapper });

    const items = [{ productId: "p1", quantity: 5 }];

    await act(async () => {
      await result.current.mutateAsync({ technicianId: "t1", items });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.technicians.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.products.lists() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.products.detail("p1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.movements.lists() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.movements.summary() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.dashboard.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.inventory.all });
  });

  it("invalidates detail for each product in items", async () => {
    const qc = createTestQueryClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const wrapper = createWrapper(qc);

    const { result } = renderHook(() => useAddToTechnicianInventory(), { wrapper });

    const items = [
      { productId: "p1", quantity: 2 },
      { productId: "p3", quantity: 7 },
    ];

    await act(async () => {
      await result.current.mutateAsync({ technicianId: "t1", items });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.products.detail("p1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.products.detail("p3") });
  });
});
