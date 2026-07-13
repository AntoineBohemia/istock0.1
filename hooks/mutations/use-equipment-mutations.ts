"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  assignEquipment,
  unassignEquipment,
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
    onSettled: (_data, _err, params) => {
      qc.invalidateQueries({ queryKey: queryKeys.equipment.all });
      qc.invalidateQueries({ queryKey: queryKeys.products.detail(params.productId) });
      qc.invalidateQueries({ queryKey: queryKeys.products.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.technicians.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
