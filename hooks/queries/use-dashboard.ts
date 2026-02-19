"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { STALE_TIME } from "@/lib/query-stale-times";
import {
  getDashboardTasks,
  getHealthScore,
  getHealthScoreHistory,
  getRecentMovements,
  getGlobalStockEvolution,
  getProductStockEvolution,
  getCategoryStockEvolution,
  getProductsNeedingRestock,
  getAllTechniciansForDashboard,
} from "@/lib/supabase/queries/dashboard";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useTaskDismissStore } from "@/lib/stores/task-dismiss-store";

export function useHealthScore(orgId?: string) {
  return useQuery({
    queryKey: queryKeys.dashboard.healthScore(orgId),
    queryFn: () => getHealthScore(orgId!),
    enabled: !!orgId,
    staleTime: STALE_TIME.MODERATE,
  });
}

export function useHealthScoreHistory(orgId?: string, months?: number) {
  return useQuery({
    queryKey: queryKeys.dashboard.healthScoreHistory(orgId, months),
    queryFn: () => getHealthScoreHistory(orgId!, months),
    enabled: !!orgId,
    staleTime: STALE_TIME.SLOW,
  });
}

export function useRecentMovements(orgId?: string, limit?: number) {
  return useQuery({
    queryKey: queryKeys.dashboard.recentMovements(orgId, limit),
    queryFn: () => getRecentMovements(limit, orgId),
    enabled: !!orgId,
  });
}

export function useGlobalStockEvolution(orgId?: string, months?: number) {
  return useQuery({
    queryKey: queryKeys.dashboard.stockEvolution(orgId, months),
    queryFn: () => getGlobalStockEvolution(months, orgId),
    enabled: !!orgId,
    staleTime: STALE_TIME.SLOW,
  });
}

export function useProductStockEvolution(productId: string, months?: number) {
  return useQuery({
    queryKey: queryKeys.dashboard.productEvolution(productId, months),
    queryFn: () => getProductStockEvolution(productId, months),
    enabled: !!productId,
    staleTime: STALE_TIME.SLOW,
  });
}

export function useCategoryStockEvolution(
  categoryId: string,
  months?: number
) {
  return useQuery({
    queryKey: queryKeys.dashboard.categoryEvolution(categoryId, months),
    queryFn: () => getCategoryStockEvolution(categoryId, months),
    enabled: !!categoryId,
    staleTime: STALE_TIME.SLOW,
  });
}

export function useProductsNeedingRestock(orgId?: string, limit?: number, scoreThreshold?: number) {
  return useQuery({
    queryKey: queryKeys.dashboard.productsNeedingRestock(orgId, scoreThreshold),
    queryFn: () => getProductsNeedingRestock(limit, orgId, scoreThreshold),
    enabled: !!orgId,
    staleTime: STALE_TIME.MODERATE,
  });
}

export function useAllTechniciansForDashboard(orgId?: string) {
  return useQuery({
    queryKey: queryKeys.dashboard.allTechnicians(orgId),
    queryFn: () => getAllTechniciansForDashboard(orgId!),
    enabled: !!orgId,
    staleTime: STALE_TIME.MODERATE,
  });
}

export function useDashboardTasks() {
  const orgId = useOrganizationStore((s) => s.currentOrganization?.id);
  const { isTaskDismissed, clearExpired } = useTaskDismissStore();

  const query = useQuery({
    queryKey: queryKeys.dashboard.tasks(orgId),
    queryFn: () => getDashboardTasks(orgId!),
    enabled: !!orgId,
    staleTime: STALE_TIME.MODERATE,
  });

  useEffect(() => {
    clearExpired();
  }, [query.data, clearExpired]);

  const tasks = useMemo(() => {
    if (!query.data) return [];
    return query.data.filter(
      (task) =>
        !task.entity_ids.some((entityId) =>
          isTaskDismissed(task.type, entityId)
        )
    );
  }, [query.data, isTaskDismissed]);

  return { ...query, data: tasks };
}
