"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { STALE_TIME } from "@/lib/query-stale-times";
import {
  getProducts,
  getProduct,
  getProductsStats,
  type ProductFilters,
} from "@/lib/supabase/queries/products";

export function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: queryKeys.products.list(filters),
    queryFn: () => getProducts(filters),
    enabled: !!filters.organizationId,
    placeholderData: (prev) => prev,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.products.detail(id),
    queryFn: () => getProduct(id),
    enabled: !!id,
  });
}

export function useProductsStats(orgId?: string) {
  return useQuery({
    queryKey: queryKeys.products.stats(orgId),
    queryFn: () => getProductsStats(orgId),
    enabled: !!orgId,
    staleTime: STALE_TIME.MODERATE,
  });
}
