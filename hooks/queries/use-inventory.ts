"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { getAvailableProductsForRestock } from "@/lib/supabase/queries/inventory";

export function useAvailableProductsForRestock(orgId?: string) {
  return useQuery({
    queryKey: queryKeys.inventory.availableProducts(orgId),
    queryFn: () => getAvailableProductsForRestock(),
    enabled: !!orgId,
  });
}
