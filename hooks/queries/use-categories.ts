"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { STALE_TIME } from "@/lib/query-stale-times";
import {
  getCategories,
  getCategoriesTree,
  getCategoryById,
} from "@/lib/supabase/queries/categories";

export function useCategories(orgId?: string) {
  return useQuery({
    queryKey: queryKeys.categories.list(orgId),
    queryFn: () => getCategories(orgId),
    enabled: !!orgId,
    staleTime: STALE_TIME.SLOW,
  });
}

export function useCategoriesTree(orgId?: string) {
  return useQuery({
    queryKey: queryKeys.categories.tree(orgId),
    queryFn: () => getCategoriesTree(orgId),
    enabled: !!orgId,
    staleTime: STALE_TIME.SLOW,
  });
}

export function useCategory(id: string) {
  return useQuery({
    queryKey: queryKeys.categories.detail(id),
    queryFn: () => getCategoryById(id),
    enabled: !!id,
    staleTime: STALE_TIME.SLOW,
  });
}
