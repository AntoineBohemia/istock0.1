import type { ProductFilters } from "@/lib/supabase/queries/products";
import type { StockMovementFilters } from "@/lib/supabase/queries/stock-movements";

export const queryKeys = {
  products: {
    all: ["products"] as const,
    lists: () => [...queryKeys.products.all, "list"] as const,
    list: (filters: ProductFilters) =>
      [...queryKeys.products.lists(), filters] as const,
    details: () => [...queryKeys.products.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.products.details(), id] as const,
    stats: (orgId?: string) =>
      [...queryKeys.products.all, "stats", orgId] as const,
  },

  categories: {
    all: ["categories"] as const,
    list: (orgId?: string) =>
      [...queryKeys.categories.all, "list", orgId] as const,
    tree: (orgId?: string) =>
      [...queryKeys.categories.all, "tree", orgId] as const,
    detail: (id: string) =>
      [...queryKeys.categories.all, "detail", id] as const,
  },

  movements: {
    all: ["movements"] as const,
    lists: () => [...queryKeys.movements.all, "list"] as const,
    list: (filters: StockMovementFilters) =>
      [...queryKeys.movements.lists(), filters] as const,
    byProduct: (productId: string) =>
      [...queryKeys.movements.all, "byProduct", productId] as const,
    stats: (productId: string, months?: number) =>
      [...queryKeys.movements.all, "stats", productId, months] as const,
    summary: (orgId?: string) => [...queryKeys.movements.all, "summary", orgId] as const,
  },

  technicians: {
    all: ["technicians"] as const,
    list: (orgId?: string) =>
      [...queryKeys.technicians.all, "list", orgId] as const,
    detail: (id: string) =>
      [...queryKeys.technicians.all, "detail", id] as const,
    stats: (orgId: string) =>
      [...queryKeys.technicians.all, "stats", orgId] as const,
    inventory: (techId: string) =>
      [...queryKeys.technicians.all, "inventory", techId] as const,
    history: (techId: string) =>
      [...queryKeys.technicians.all, "history", techId] as const,
    movements: (techId: string) =>
      [...queryKeys.technicians.all, "movements", techId] as const,
  },

  dashboard: {
    all: ["dashboard"] as const,
    stats: (orgId?: string) =>
      [...queryKeys.dashboard.all, "stats", orgId] as const,
    recentMovements: (orgId?: string, limit?: number) =>
      [...queryKeys.dashboard.all, "recentMovements", orgId, limit] as const,
    stockEvolution: (orgId?: string, months?: number) =>
      [...queryKeys.dashboard.all, "stockEvolution", orgId, months] as const,
    productEvolution: (productId: string, months?: number) =>
      [...queryKeys.dashboard.all, "productEvolution", productId, months] as const,
    categoryEvolution: (categoryId: string, months?: number) =>
      [...queryKeys.dashboard.all, "categoryEvolution", categoryId, months] as const,
    technicianStats: (orgId?: string) =>
      [...queryKeys.dashboard.all, "technicianStats", orgId] as const,
    productsNeedingRestock: (orgId?: string) =>
      [...queryKeys.dashboard.all, "productsNeedingRestock", orgId] as const,
    techniciansNeedingRestock: (orgId?: string) =>
      [...queryKeys.dashboard.all, "techniciansNeedingRestock", orgId] as const,
    tasks: (orgId?: string) =>
      [...queryKeys.dashboard.all, "tasks", orgId] as const,
  },

  organizations: {
    all: ["organizations"] as const,
    list: () => [...queryKeys.organizations.all, "list"] as const,
    members: (orgId: string) =>
      [...queryKeys.organizations.all, "members", orgId] as const,
    invitations: (orgId: string) =>
      [...queryKeys.organizations.all, "invitations", orgId] as const,
  },

  inventory: {
    all: ["inventory"] as const,
    availableProducts: (orgId?: string) =>
      [...queryKeys.inventory.all, "availableProducts", orgId] as const,
  },
};
