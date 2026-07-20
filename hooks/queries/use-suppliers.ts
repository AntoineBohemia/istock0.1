"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { STALE_TIME } from "@/lib/query-stale-times";
import {
  getSuppliers,
  getSuppliersWithProducts,
  getSuppliersWithStats,
  getSupplierInvoices,
  getSupplier,
} from "@/lib/supabase/queries/suppliers";

export function useSuppliers(orgId?: string) {
  return useQuery({
    queryKey: queryKeys.suppliers.list(orgId),
    queryFn: () => getSuppliers(orgId),
    enabled: !!orgId,
    staleTime: STALE_TIME.SLOW,
  });
}

export function useSuppliersWithProducts(orgId?: string) {
  return useQuery({
    queryKey: queryKeys.suppliers.withProducts(orgId!),
    queryFn: () => getSuppliersWithProducts(orgId!),
    enabled: !!orgId,
    staleTime: STALE_TIME.SLOW,
  });
}

export function useSuppliersWithStats(orgId?: string) {
  return useQuery({
    queryKey: queryKeys.suppliers.withStats(orgId!),
    queryFn: () => getSuppliersWithStats(orgId!),
    enabled: !!orgId,
    staleTime: STALE_TIME.SLOW,
  });
}

export function useSupplierInvoices(supplierId?: string) {
  return useQuery({
    queryKey: queryKeys.suppliers.invoices(supplierId!),
    queryFn: () => getSupplierInvoices(supplierId!),
    enabled: !!supplierId,
    staleTime: STALE_TIME.SLOW,
  });
}

export function useSupplier(id?: string) {
  return useQuery({
    queryKey: queryKeys.suppliers.detail(id!),
    queryFn: () => getSupplier(id!),
    enabled: !!id,
    staleTime: STALE_TIME.SLOW,
  });
}
