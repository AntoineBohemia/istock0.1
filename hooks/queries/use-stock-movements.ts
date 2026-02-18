"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { STALE_TIME } from "@/lib/query-stale-times";
import {
  getStockMovements,
  getProductMovements,
  getProductMovementStats,
  getMovementsSummary,
  type StockMovementFilters,
} from "@/lib/supabase/queries/stock-movements";

export function useStockMovements(filters: StockMovementFilters) {
  return useQuery({
    queryKey: queryKeys.movements.list(filters),
    queryFn: () => getStockMovements(filters),
    enabled: !!filters.organizationId,
    placeholderData: (prev) => prev,
  });
}

export function useProductMovements(productId: string, limit?: number) {
  return useQuery({
    queryKey: queryKeys.movements.byProduct(productId),
    queryFn: () => getProductMovements(productId, limit),
    enabled: !!productId,
  });
}

export function useProductMovementStats(productId: string, months?: number) {
  return useQuery({
    queryKey: queryKeys.movements.stats(productId, months),
    queryFn: () => getProductMovementStats(productId, months),
    enabled: !!productId,
    staleTime: STALE_TIME.MODERATE,
  });
}

export function useMovementsSummary(orgId?: string) {
  return useQuery({
    queryKey: queryKeys.movements.summary(orgId),
    queryFn: () => getMovementsSummary(orgId),
    enabled: !!orgId,
    staleTime: STALE_TIME.MODERATE,
  });
}
