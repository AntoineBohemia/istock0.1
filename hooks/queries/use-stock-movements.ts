"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { STALE_TIME } from "@/lib/query-stale-times";
import {
  getStockMovements,
  getProductMovements,
  getProductMovementStats,
  getMovementsSummary,
  getYearlyEntryValuesByOrg,
  getYearlyEntryQtyByProduct,
  getProductPriceHistory,
  type StockMovementFilters,
} from "@/lib/supabase/queries/stock-movements";

export function useStockMovements(filters: StockMovementFilters = {}) {
  return useQuery({
    queryKey: queryKeys.movements.list(filters),
    queryFn: () => getStockMovements(filters),
    staleTime: STALE_TIME.REALTIME,
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

export function useYearlyEntryValues(year?: number) {
  const targetYear = year ?? new Date().getFullYear();
  return useQuery({
    queryKey: queryKeys.movements.yearlyEntryValues(targetYear),
    queryFn: () => getYearlyEntryValuesByOrg(targetYear),
    staleTime: STALE_TIME.MODERATE,
  });
}

export function useYearlyEntryQtyByProduct(year?: number) {
  const targetYear = year ?? new Date().getFullYear();
  return useQuery({
    queryKey: queryKeys.movements.yearlyEntryQtyByProduct(targetYear),
    queryFn: () => getYearlyEntryQtyByProduct(targetYear),
    staleTime: STALE_TIME.MODERATE,
  });
}

export function useProductPriceHistory(productId: string) {
  return useQuery({
    queryKey: queryKeys.movements.priceHistory(productId),
    queryFn: () => getProductPriceHistory(productId),
    enabled: !!productId,
    staleTime: STALE_TIME.SLOW,
  });
}
