"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { createSupplier, updateSupplier, deleteSupplier } from "@/lib/supabase/queries/suppliers";

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    // phone et logoUrl doivent figurer ici : sans eux, ils seraient
    // silencieusement perdus par tout appelant de ce hook.
    mutationFn: ({
      organizationId,
      name,
      websiteUrl,
      email,
      phone,
      logoUrl,
    }: {
      organizationId: string;
      name: string;
      websiteUrl?: string | null;
      email?: string | null;
      phone?: string | null;
      logoUrl?: string | null;
    }) => createSupplier(organizationId, name, websiteUrl, email, phone, logoUrl),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.suppliers.all });
    },
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    // Type derive de updateSupplier plutot que recopie : une copie manuelle
    // se desynchronise a chaque nouveau champ, qui est alors perdu en silence.
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateSupplier>[1] }) =>
      updateSupplier(id, data),
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
