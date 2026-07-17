"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  assignEquipment,
  unassignEquipment,
  type EquipmentAssignment,
} from "@/lib/supabase/queries/equipment";

interface AssignParams {
  organizationId: string;
  productId: string;
  technicianId: string;
  quantity?: number;
}

export function useAssignEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: AssignParams) =>
      assignEquipment(
        params.organizationId,
        params.productId,
        params.technicianId,
        params.quantity ?? 1
      ),
    onMutate: async (params) => {
      const key = queryKeys.equipment.byTechnician(params.technicianId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<EquipmentAssignment[]>(key);

      qc.setQueryData<EquipmentAssignment[]>(key, (old = []) => {
        const existing = old.find((a) => a.product_id === params.productId);
        if (existing) {
          return old.map((a) =>
            a.product_id === params.productId
              ? { ...a, quantity: a.quantity + (params.quantity ?? 1) }
              : a
          );
        }
        return [
          {
            id: `optimistic-${Date.now()}`,
            product_id: params.productId,
            technician_id: params.technicianId,
            organization_id: params.organizationId,
            quantity: params.quantity ?? 1,
            assigned_at: new Date().toISOString(),
          },
          ...old,
        ];
      });

      return { previous };
    },
    onError: (_err, params, context) => {
      if (context?.previous) {
        qc.setQueryData(queryKeys.equipment.byTechnician(params.technicianId), context.previous);
      }
    },
    onSettled: (_data, _err, params) => {
      qc.invalidateQueries({ queryKey: queryKeys.equipment.all });
      qc.invalidateQueries({ queryKey: queryKeys.products.detail(params.productId) });
      qc.invalidateQueries({ queryKey: queryKeys.products.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.technicians.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useUnassignEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: AssignParams) =>
      unassignEquipment(
        params.organizationId,
        params.productId,
        params.technicianId,
        params.quantity ?? 1
      ),
    onMutate: async (params) => {
      const key = queryKeys.equipment.byTechnician(params.technicianId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<EquipmentAssignment[]>(key);

      qc.setQueryData<EquipmentAssignment[]>(key, (old = []) => {
        return old
          .map((a) =>
            a.product_id === params.productId
              ? { ...a, quantity: a.quantity - (params.quantity ?? 1) }
              : a
          )
          .filter((a) => a.quantity > 0);
      });

      return { previous };
    },
    onError: (_err, params, context) => {
      if (context?.previous) {
        qc.setQueryData(queryKeys.equipment.byTechnician(params.technicianId), context.previous);
      }
    },
    onSettled: (_data, _err, params) => {
      qc.invalidateQueries({ queryKey: queryKeys.equipment.all });
      qc.invalidateQueries({ queryKey: queryKeys.products.detail(params.productId) });
      qc.invalidateQueries({ queryKey: queryKeys.products.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.technicians.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
