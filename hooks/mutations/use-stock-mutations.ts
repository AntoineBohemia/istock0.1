"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  createEntry,
  createExit,
} from "@/lib/supabase/queries/stock-movements";

interface CreateEntryParams {
  organizationId: string;
  productId: string;
  quantity: number;
  notes?: string;
}

interface CreateExitParams {
  organizationId: string;
  productId: string;
  quantity: number;
  type: "exit_technician" | "exit_anonymous" | "exit_loss";
  technicianId?: string;
  notes?: string;
}

export function useCreateStockEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateEntryParams) =>
      createEntry(
        params.organizationId,
        params.productId,
        params.quantity,
        params.notes
      ),
    onMutate: async (params) => {
      // Optimistic update on product detail
      await qc.cancelQueries({
        queryKey: queryKeys.products.detail(params.productId),
      });
      const previous = qc.getQueryData(
        queryKeys.products.detail(params.productId)
      );
      qc.setQueryData(
        queryKeys.products.detail(params.productId),
        (old: any) =>
          old
            ? { ...old, stock_current: old.stock_current + params.quantity }
            : old
      );
      return { previous, productId: params.productId };
    },
    onError: (_err, _params, context) => {
      if (context?.previous) {
        qc.setQueryData(
          queryKeys.products.detail(context.productId),
          context.previous
        );
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.products.all });
      qc.invalidateQueries({ queryKey: queryKeys.movements.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useCreateStockExit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateExitParams) =>
      createExit(
        params.organizationId,
        params.productId,
        params.quantity,
        params.type,
        params.technicianId,
        params.notes
      ),
    onMutate: async (params) => {
      await qc.cancelQueries({
        queryKey: queryKeys.products.detail(params.productId),
      });
      const previous = qc.getQueryData(
        queryKeys.products.detail(params.productId)
      );
      qc.setQueryData(
        queryKeys.products.detail(params.productId),
        (old: any) =>
          old
            ? { ...old, stock_current: old.stock_current - params.quantity }
            : old
      );
      return { previous, productId: params.productId };
    },
    onError: (_err, _params, context) => {
      if (context?.previous) {
        qc.setQueryData(
          queryKeys.products.detail(context.productId),
          context.previous
        );
      }
    },
    onSettled: (_data, _err, params) => {
      qc.invalidateQueries({ queryKey: queryKeys.products.all });
      qc.invalidateQueries({ queryKey: queryKeys.movements.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      if (params.type === "exit_technician") {
        qc.invalidateQueries({ queryKey: queryKeys.technicians.all });
      }
    },
  });
}
