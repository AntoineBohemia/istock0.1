"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { STALE_TIME } from "@/lib/query-stale-times";
import { getSuppliers } from "@/lib/supabase/queries/suppliers";

export function useSuppliers(orgId?: string) {
  return useQuery({
    queryKey: queryKeys.suppliers.list(orgId),
    queryFn: () => getSuppliers(orgId),
    enabled: !!orgId,
    staleTime: STALE_TIME.SLOW,
  });
}
