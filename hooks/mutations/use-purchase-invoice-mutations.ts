"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  createPurchaseInvoice,
  updatePurchaseInvoice,
  deletePurchaseInvoice,
} from "@/lib/supabase/queries/purchase-invoices";
import { linkMovementToInvoice } from "@/lib/supabase/queries/stock-movements";

export function useCreatePurchaseInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createPurchaseInvoice,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.purchaseInvoices.all });
    },
  });
}

export function useUpdatePurchaseInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...fields }: { id: string } & Parameters<typeof updatePurchaseInvoice>[1]) =>
      updatePurchaseInvoice(id, fields),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.purchaseInvoices.all });
    },
  });
}

export function useDeletePurchaseInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, filePath }: { id: string; filePath?: string | null }) =>
      deletePurchaseInvoice(id, filePath),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.purchaseInvoices.all });
      // Les achats concernés perdent leur rattachement
      qc.invalidateQueries({ queryKey: queryKeys.movements.all });
    },
  });
}

/** Rattache ou détache un achat existant d'une facture */
export function useLinkMovementToInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ movementId, invoiceId }: { movementId: string; invoiceId: string | null }) =>
      linkMovementToInvoice(movementId, invoiceId),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.purchaseInvoices.all });
      qc.invalidateQueries({ queryKey: queryKeys.movements.all });
    },
  });
}
