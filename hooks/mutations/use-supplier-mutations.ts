"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "@/lib/supabase/queries/suppliers";

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      name,
      websiteUrl,
    }: {
      organizationId: string;
      name: string;
      websiteUrl?: string | null;
    }) => createSupplier(organizationId, name, websiteUrl),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.suppliers.all });
    },
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; website_url?: string | null };
    }) => updateSupplier(id, data),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.suppliers.all });
    },
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSupplier(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.suppliers.all });
    },
  });
}
