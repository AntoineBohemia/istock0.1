"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { getPurchaseInvoices, getPurchaseInvoice } from "@/lib/supabase/queries/purchase-invoices";

export function usePurchaseInvoices(orgId?: string) {
  return useQuery({
    queryKey: queryKeys.purchaseInvoices.list(orgId),
    queryFn: () => getPurchaseInvoices(orgId),
    enabled: !!orgId,
  });
}

export function usePurchaseInvoice(id?: string) {
  return useQuery({
    queryKey: queryKeys.purchaseInvoices.detail(id ?? ""),
    queryFn: () => getPurchaseInvoice(id!),
    enabled: !!id,
  });
}
