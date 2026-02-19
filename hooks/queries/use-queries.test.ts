import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createTestQueryClient, createWrapper } from "@/lib/__mocks__/test-query-utils";

// ─── Mock all query modules ─────────────────────────────────────────
vi.mock("@/lib/supabase/queries/products", () => ({
  getProducts: vi.fn().mockResolvedValue({ products: [], total: 0, page: 1, pageSize: 10, totalPages: 0 }),
  getProduct: vi.fn().mockResolvedValue(null),
  getProductsStats: vi.fn().mockResolvedValue({ total: 0, lowStock: 0, outOfStock: 0, totalValue: 0 }),
}));

vi.mock("@/lib/supabase/queries/stock-movements", () => ({
  getStockMovements: vi.fn().mockResolvedValue({ movements: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }),
  getProductMovements: vi.fn().mockResolvedValue([]),
  getProductMovementStats: vi.fn().mockResolvedValue([]),
  getMovementsSummary: vi.fn().mockResolvedValue({ totalEntries: 0, totalExits: 0, recentMovements: 0 }),
}));

vi.mock("@/lib/supabase/queries/inventory", () => ({
  getAvailableProductsForRestock: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/supabase/queries/technicians", () => ({
  getTechnicians: vi.fn().mockResolvedValue([]),
  getTechnician: vi.fn().mockResolvedValue(null),
  getTechniciansStats: vi.fn().mockResolvedValue({}),
  getTechnicianInventoryHistory: vi.fn().mockResolvedValue([]),
  getTechnicianStockMovements: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/supabase/queries/categories", () => ({
  getCategories: vi.fn().mockResolvedValue([]),
  getCategoriesTree: vi.fn().mockResolvedValue([]),
  getCategoryById: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/supabase/queries/organizations", () => ({
  getUserOrganizations: vi.fn().mockResolvedValue([]),
  getOrganizationMembers: vi.fn().mockResolvedValue([]),
  getPendingInvitations: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/supabase/queries/dashboard", () => ({
  getDashboardStats: vi.fn().mockResolvedValue({}),
  getRecentMovements: vi.fn().mockResolvedValue([]),
  getGlobalStockEvolution: vi.fn().mockResolvedValue([]),
  getProductStockEvolution: vi.fn().mockResolvedValue([]),
  getCategoryStockEvolution: vi.fn().mockResolvedValue([]),
  getTechnicianStats: vi.fn().mockResolvedValue([]),
  getProductsNeedingRestock: vi.fn().mockResolvedValue([]),
  getTechniciansNeedingRestock: vi.fn().mockResolvedValue([]),
}));

// ─── Import mocked functions ────────────────────────────────────────
import { getProducts, getProduct, getProductsStats } from "@/lib/supabase/queries/products";
import { getStockMovements, getProductMovements, getProductMovementStats, getMovementsSummary } from "@/lib/supabase/queries/stock-movements";
import { getAvailableProductsForRestock } from "@/lib/supabase/queries/inventory";
import { getTechnicians, getTechnician, getTechniciansStats, getTechnicianInventoryHistory, getTechnicianStockMovements } from "@/lib/supabase/queries/technicians";
import { getCategories, getCategoriesTree, getCategoryById } from "@/lib/supabase/queries/categories";
import { getUserOrganizations, getOrganizationMembers, getPendingInvitations } from "@/lib/supabase/queries/organizations";
import { getDashboardStats, getRecentMovements, getGlobalStockEvolution, getProductStockEvolution, getCategoryStockEvolution, getTechnicianStats, getProductsNeedingRestock, getTechniciansNeedingRestock } from "@/lib/supabase/queries/dashboard";

// ─── Import hooks ───────────────────────────────────────────────────
import { useProducts, useProduct, useProductsStats } from "./use-products";
import { useStockMovements, useProductMovements, useProductMovementStats, useMovementsSummary } from "./use-stock-movements";
import { useAvailableProductsForRestock } from "./use-inventory";
import { useTechnicians, useTechnician, useTechniciansStats, useTechnicianHistory, useTechnicianMovements } from "./use-technicians";
import { useCategories, useCategoriesTree, useCategory } from "./use-categories";
import { useOrganizations, useOrganizationMembers, usePendingInvitations } from "./use-organizations";
import { useDashboardStats, useRecentMovements, useGlobalStockEvolution, useProductStockEvolution, useCategoryStockEvolution, useTechnicianStatsForDashboard, useProductsNeedingRestock, useTechniciansNeedingRestock } from "./use-dashboard";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── useProducts ────────────────────────────────────────────────────
describe("useProducts", () => {
  it("calls getProducts with filters when organizationId is set", async () => {
    const filters = { organizationId: "org-1", search: "vis" };
    const wrapper = createWrapper();

    renderHook(() => useProducts(filters), { wrapper });

    await waitFor(() => {
      expect(getProducts).toHaveBeenCalledWith(filters);
    });
  });

  it("does not call getProducts when organizationId is falsy", async () => {
    const wrapper = createWrapper();

    renderHook(() => useProducts({}), { wrapper });

    // Wait a tick and verify it was never called
    await new Promise((r) => setTimeout(r, 50));
    expect(getProducts).not.toHaveBeenCalled();
  });
});

// ─── useProduct ─────────────────────────────────────────────────────
describe("useProduct", () => {
  it("calls getProduct with id when id is truthy", async () => {
    const wrapper = createWrapper();

    renderHook(() => useProduct("p1"), { wrapper });

    await waitFor(() => {
      expect(getProduct).toHaveBeenCalledWith("p1");
    });
  });

  it("does not call getProduct when id is empty", async () => {
    const wrapper = createWrapper();

    renderHook(() => useProduct(""), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(getProduct).not.toHaveBeenCalled();
  });
});

// ─── useProductsStats ───────────────────────────────────────────────
describe("useProductsStats", () => {
  it("calls getProductsStats with orgId", async () => {
    const wrapper = createWrapper();

    renderHook(() => useProductsStats("org-1"), { wrapper });

    await waitFor(() => {
      expect(getProductsStats).toHaveBeenCalledWith("org-1");
    });
  });

  it("does not call getProductsStats when orgId is undefined", async () => {
    const wrapper = createWrapper();

    renderHook(() => useProductsStats(undefined), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(getProductsStats).not.toHaveBeenCalled();
  });
});

// ─── useStockMovements ──────────────────────────────────────────────
describe("useStockMovements", () => {
  it("calls getStockMovements with filters", async () => {
    const filters = { organizationId: "org-1" };
    const wrapper = createWrapper();

    renderHook(() => useStockMovements(filters), { wrapper });

    await waitFor(() => {
      expect(getStockMovements).toHaveBeenCalledWith(filters);
    });
  });

  it("does not call getStockMovements without organizationId", async () => {
    const wrapper = createWrapper();

    renderHook(() => useStockMovements({}), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(getStockMovements).not.toHaveBeenCalled();
  });
});

// ─── useProductMovements ────────────────────────────────────────────
describe("useProductMovements", () => {
  it("calls getProductMovements with productId and limit", async () => {
    const wrapper = createWrapper();

    renderHook(() => useProductMovements("p1", 10), { wrapper });

    await waitFor(() => {
      expect(getProductMovements).toHaveBeenCalledWith("p1", 10);
    });
  });

  it("does not call getProductMovements when productId is empty", async () => {
    const wrapper = createWrapper();

    renderHook(() => useProductMovements(""), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(getProductMovements).not.toHaveBeenCalled();
  });
});

// ─── useProductMovementStats ────────────────────────────────────────
describe("useProductMovementStats", () => {
  it("calls getProductMovementStats with productId and months", async () => {
    const wrapper = createWrapper();

    renderHook(() => useProductMovementStats("p1", 6), { wrapper });

    await waitFor(() => {
      expect(getProductMovementStats).toHaveBeenCalledWith("p1", 6);
    });
  });

  it("does not call when productId is empty", async () => {
    const wrapper = createWrapper();

    renderHook(() => useProductMovementStats(""), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(getProductMovementStats).not.toHaveBeenCalled();
  });
});

// ─── useMovementsSummary ────────────────────────────────────────────
describe("useMovementsSummary", () => {
  it("calls getMovementsSummary with orgId", async () => {
    const wrapper = createWrapper();

    renderHook(() => useMovementsSummary("org-1"), { wrapper });

    await waitFor(() => {
      expect(getMovementsSummary).toHaveBeenCalledWith("org-1");
    });
  });

  it("does not call when orgId is undefined", async () => {
    const wrapper = createWrapper();

    renderHook(() => useMovementsSummary(undefined), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(getMovementsSummary).not.toHaveBeenCalled();
  });
});

// ─── useAvailableProductsForRestock ─────────────────────────────────
describe("useAvailableProductsForRestock", () => {
  it("calls getAvailableProductsForRestock with orgId", async () => {
    const wrapper = createWrapper();

    renderHook(() => useAvailableProductsForRestock("org-1"), { wrapper });

    await waitFor(() => {
      expect(getAvailableProductsForRestock).toHaveBeenCalledWith("org-1");
    });
  });

  it("does not call when orgId is undefined", async () => {
    const wrapper = createWrapper();

    renderHook(() => useAvailableProductsForRestock(undefined), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(getAvailableProductsForRestock).not.toHaveBeenCalled();
  });
});

// ─── useTechnicians ─────────────────────────────────────────────────
describe("useTechnicians", () => {
  it("calls getTechnicians with orgId", async () => {
    const wrapper = createWrapper();

    renderHook(() => useTechnicians("org-1"), { wrapper });

    await waitFor(() => {
      expect(getTechnicians).toHaveBeenCalledWith("org-1");
    });
  });

  it("does not call when orgId is undefined", async () => {
    const wrapper = createWrapper();

    renderHook(() => useTechnicians(undefined), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(getTechnicians).not.toHaveBeenCalled();
  });
});

// ─── useTechnician ──────────────────────────────────────────────────
describe("useTechnician", () => {
  it("calls getTechnician with id", async () => {
    const wrapper = createWrapper();

    renderHook(() => useTechnician("t1"), { wrapper });

    await waitFor(() => {
      expect(getTechnician).toHaveBeenCalledWith("t1");
    });
  });

  it("does not call when id is empty", async () => {
    const wrapper = createWrapper();

    renderHook(() => useTechnician(""), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(getTechnician).not.toHaveBeenCalled();
  });
});

// ─── useTechniciansStats ────────────────────────────────────────────
describe("useTechniciansStats", () => {
  it("calls getTechniciansStats with orgId", async () => {
    const wrapper = createWrapper();

    renderHook(() => useTechniciansStats("org-1"), { wrapper });

    await waitFor(() => {
      expect(getTechniciansStats).toHaveBeenCalledWith("org-1");
    });
  });

  it("does not call when orgId is empty", async () => {
    const wrapper = createWrapper();

    renderHook(() => useTechniciansStats(""), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(getTechniciansStats).not.toHaveBeenCalled();
  });
});

// ─── useTechnicianHistory ───────────────────────────────────────────
describe("useTechnicianHistory", () => {
  it("calls getTechnicianInventoryHistory with techId", async () => {
    const wrapper = createWrapper();

    renderHook(() => useTechnicianHistory("t1"), { wrapper });

    await waitFor(() => {
      expect(getTechnicianInventoryHistory).toHaveBeenCalledWith("t1");
    });
  });

  it("does not call when techId is empty", async () => {
    const wrapper = createWrapper();

    renderHook(() => useTechnicianHistory(""), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(getTechnicianInventoryHistory).not.toHaveBeenCalled();
  });
});

// ─── useTechnicianMovements ─────────────────────────────────────────
describe("useTechnicianMovements", () => {
  it("calls getTechnicianStockMovements with techId", async () => {
    const wrapper = createWrapper();

    renderHook(() => useTechnicianMovements("t1"), { wrapper });

    await waitFor(() => {
      expect(getTechnicianStockMovements).toHaveBeenCalledWith("t1");
    });
  });

  it("does not call when techId is empty", async () => {
    const wrapper = createWrapper();

    renderHook(() => useTechnicianMovements(""), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(getTechnicianStockMovements).not.toHaveBeenCalled();
  });
});

// ─── useCategories ──────────────────────────────────────────────────
describe("useCategories", () => {
  it("calls getCategories with orgId", async () => {
    const wrapper = createWrapper();

    renderHook(() => useCategories("org-1"), { wrapper });

    await waitFor(() => {
      expect(getCategories).toHaveBeenCalledWith("org-1");
    });
  });

  it("does not call when orgId is undefined", async () => {
    const wrapper = createWrapper();

    renderHook(() => useCategories(undefined), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(getCategories).not.toHaveBeenCalled();
  });
});

// ─── useCategoriesTree ──────────────────────────────────────────────
describe("useCategoriesTree", () => {
  it("calls getCategoriesTree with orgId", async () => {
    const wrapper = createWrapper();

    renderHook(() => useCategoriesTree("org-1"), { wrapper });

    await waitFor(() => {
      expect(getCategoriesTree).toHaveBeenCalledWith("org-1");
    });
  });

  it("does not call when orgId is undefined", async () => {
    const wrapper = createWrapper();

    renderHook(() => useCategoriesTree(undefined), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(getCategoriesTree).not.toHaveBeenCalled();
  });
});

// ─── useCategory ────────────────────────────────────────────────────
describe("useCategory", () => {
  it("calls getCategoryById with id", async () => {
    const wrapper = createWrapper();

    renderHook(() => useCategory("cat-1"), { wrapper });

    await waitFor(() => {
      expect(getCategoryById).toHaveBeenCalledWith("cat-1");
    });
  });

  it("does not call when id is empty", async () => {
    const wrapper = createWrapper();

    renderHook(() => useCategory(""), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(getCategoryById).not.toHaveBeenCalled();
  });
});

// ─── useOrganizations ───────────────────────────────────────────────
describe("useOrganizations", () => {
  it("calls getUserOrganizations (always enabled)", async () => {
    const wrapper = createWrapper();

    renderHook(() => useOrganizations(), { wrapper });

    await waitFor(() => {
      expect(getUserOrganizations).toHaveBeenCalled();
    });
  });
});

// ─── useOrganizationMembers ─────────────────────────────────────────
describe("useOrganizationMembers", () => {
  it("calls getOrganizationMembers with orgId", async () => {
    const wrapper = createWrapper();

    renderHook(() => useOrganizationMembers("org-1"), { wrapper });

    await waitFor(() => {
      expect(getOrganizationMembers).toHaveBeenCalledWith("org-1");
    });
  });

  it("does not call when orgId is undefined", async () => {
    const wrapper = createWrapper();

    renderHook(() => useOrganizationMembers(undefined), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(getOrganizationMembers).not.toHaveBeenCalled();
  });
});

// ─── usePendingInvitations ──────────────────────────────────────────
describe("usePendingInvitations", () => {
  it("calls getPendingInvitations with orgId", async () => {
    const wrapper = createWrapper();

    renderHook(() => usePendingInvitations("org-1"), { wrapper });

    await waitFor(() => {
      expect(getPendingInvitations).toHaveBeenCalledWith("org-1");
    });
  });

  it("does not call when orgId is undefined", async () => {
    const wrapper = createWrapper();

    renderHook(() => usePendingInvitations(undefined), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(getPendingInvitations).not.toHaveBeenCalled();
  });
});

// ─── useDashboardStats ──────────────────────────────────────────────
describe("useDashboardStats", () => {
  it("calls getDashboardStats with orgId", async () => {
    const wrapper = createWrapper();

    renderHook(() => useDashboardStats("org-1"), { wrapper });

    await waitFor(() => {
      expect(getDashboardStats).toHaveBeenCalledWith("org-1");
    });
  });

  it("does not call when orgId is undefined", async () => {
    const wrapper = createWrapper();

    renderHook(() => useDashboardStats(undefined), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(getDashboardStats).not.toHaveBeenCalled();
  });
});

// ─── useRecentMovements ─────────────────────────────────────────────
describe("useRecentMovements", () => {
  it("calls getRecentMovements with limit and orgId", async () => {
    const wrapper = createWrapper();

    renderHook(() => useRecentMovements("org-1", 5), { wrapper });

    await waitFor(() => {
      expect(getRecentMovements).toHaveBeenCalledWith(5, "org-1");
    });
  });

  it("does not call when orgId is undefined", async () => {
    const wrapper = createWrapper();

    renderHook(() => useRecentMovements(undefined), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(getRecentMovements).not.toHaveBeenCalled();
  });
});

// ─── useGlobalStockEvolution ────────────────────────────────────────
describe("useGlobalStockEvolution", () => {
  it("calls getGlobalStockEvolution with months and orgId", async () => {
    const wrapper = createWrapper();

    renderHook(() => useGlobalStockEvolution("org-1", 6), { wrapper });

    await waitFor(() => {
      expect(getGlobalStockEvolution).toHaveBeenCalledWith(6, "org-1");
    });
  });

  it("does not call when orgId is undefined", async () => {
    const wrapper = createWrapper();

    renderHook(() => useGlobalStockEvolution(undefined), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(getGlobalStockEvolution).not.toHaveBeenCalled();
  });
});

// ─── useProductStockEvolution ───────────────────────────────────────
describe("useProductStockEvolution", () => {
  it("calls getProductStockEvolution with productId and months", async () => {
    const wrapper = createWrapper();

    renderHook(() => useProductStockEvolution("p1", 3), { wrapper });

    await waitFor(() => {
      expect(getProductStockEvolution).toHaveBeenCalledWith("p1", 3);
    });
  });

  it("does not call when productId is empty", async () => {
    const wrapper = createWrapper();

    renderHook(() => useProductStockEvolution(""), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(getProductStockEvolution).not.toHaveBeenCalled();
  });
});

// ─── useCategoryStockEvolution ──────────────────────────────────────
describe("useCategoryStockEvolution", () => {
  it("calls getCategoryStockEvolution with categoryId and months", async () => {
    const wrapper = createWrapper();

    renderHook(() => useCategoryStockEvolution("cat-1", 6), { wrapper });

    await waitFor(() => {
      expect(getCategoryStockEvolution).toHaveBeenCalledWith("cat-1", 6);
    });
  });

  it("does not call when categoryId is empty", async () => {
    const wrapper = createWrapper();

    renderHook(() => useCategoryStockEvolution(""), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(getCategoryStockEvolution).not.toHaveBeenCalled();
  });
});

// ─── useTechnicianStatsForDashboard ─────────────────────────────────
describe("useTechnicianStatsForDashboard", () => {
  it("calls getTechnicianStats with orgId", async () => {
    const wrapper = createWrapper();

    renderHook(() => useTechnicianStatsForDashboard("org-1"), { wrapper });

    await waitFor(() => {
      expect(getTechnicianStats).toHaveBeenCalledWith("org-1", undefined);
    });
  });

  it("does not call when orgId is undefined", async () => {
    const wrapper = createWrapper();

    renderHook(() => useTechnicianStatsForDashboard(undefined), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(getTechnicianStats).not.toHaveBeenCalled();
  });
});

// ─── useProductsNeedingRestock ──────────────────────────────────────
describe("useProductsNeedingRestock", () => {
  it("calls getProductsNeedingRestock with limit and orgId", async () => {
    const wrapper = createWrapper();

    renderHook(() => useProductsNeedingRestock("org-1", 10), { wrapper });

    await waitFor(() => {
      expect(getProductsNeedingRestock).toHaveBeenCalledWith(10, "org-1", undefined);
    });
  });

  it("does not call when orgId is undefined", async () => {
    const wrapper = createWrapper();

    renderHook(() => useProductsNeedingRestock(undefined), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(getProductsNeedingRestock).not.toHaveBeenCalled();
  });
});

// ─── useTechniciansNeedingRestock ───────────────────────────────────
describe("useTechniciansNeedingRestock", () => {
  it("calls getTechniciansNeedingRestock with daysThreshold and orgId", async () => {
    const wrapper = createWrapper();

    renderHook(() => useTechniciansNeedingRestock("org-1", 30), { wrapper });

    await waitFor(() => {
      expect(getTechniciansNeedingRestock).toHaveBeenCalledWith(30, "org-1");
    });
  });

  it("does not call when orgId is undefined", async () => {
    const wrapper = createWrapper();

    renderHook(() => useTechniciansNeedingRestock(undefined), { wrapper });

    await new Promise((r) => setTimeout(r, 50));
    expect(getTechniciansNeedingRestock).not.toHaveBeenCalled();
  });
});
