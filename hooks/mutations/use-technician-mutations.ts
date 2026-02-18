"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  createTechnician,
  updateTechnician,
  deleteTechnician,
  type CreateTechnicianData,
  type UpdateTechnicianData,
  type TechnicianWithInventory,
} from "@/lib/supabase/queries/technicians";

export function useCreateTechnician() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTechnicianData) => createTechnician(data),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.technicians.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useUpdateTechnician() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTechnicianData }) =>
      updateTechnician(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel detail query
      await qc.cancelQueries({ queryKey: queryKeys.technicians.detail(id) });
      // Snapshot detail
      const previousDetail = qc.getQueryData(queryKeys.technicians.detail(id));
      // Optimistic update detail
      qc.setQueryData(queryKeys.technicians.detail(id), (old: any) =>
        old ? { ...old, ...data } : old
      );

      // Snapshot and optimistic update all lists
      await qc.cancelQueries({ queryKey: queryKeys.technicians.all });
      const previousLists: [readonly unknown[], TechnicianWithInventory[] | undefined][] = [];
      qc.getQueriesData<TechnicianWithInventory[]>({
        queryKey: queryKeys.technicians.all,
      }).forEach(([key, listData]) => {
        if (Array.isArray(listData)) {
          previousLists.push([key, listData]);
          qc.setQueryData(
            key,
            listData.map((t) => (t.id === id ? { ...t, ...data } : t))
          );
        }
      });

      return { previousDetail, previousLists, id };
    },
    onError: (_err, _vars, context) => {
      if (context) {
        // Rollback detail
        if (context.previousDetail !== undefined) {
          qc.setQueryData(
            queryKeys.technicians.detail(context.id),
            context.previousDetail
          );
        }
        // Rollback lists
        context.previousLists?.forEach(([key, data]) => {
          qc.setQueryData(key, data);
        });
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.technicians.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useDeleteTechnician() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTechnician(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.technicians.all });
      const previousLists: [readonly unknown[], TechnicianWithInventory[] | undefined][] = [];

      qc.getQueriesData<TechnicianWithInventory[]>({
        queryKey: queryKeys.technicians.all,
      }).forEach(([key, data]) => {
        if (Array.isArray(data)) {
          previousLists.push([key, data]);
          qc.setQueryData(
            key,
            data.filter((t) => t.id !== id)
          );
        }
      });

      return { previousLists };
    },
    onError: (_err, _id, context) => {
      context?.previousLists?.forEach(([key, data]) => {
        qc.setQueryData(key, data);
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.technicians.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
