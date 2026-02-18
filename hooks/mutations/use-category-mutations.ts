"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/supabase/queries/categories";

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      name,
      parentId,
    }: {
      organizationId: string;
      name: string;
      parentId?: string | null;
    }) => createCategory(organizationId, name, parentId),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      name,
      parentId,
    }: {
      id: string;
      name: string;
      parentId?: string | null;
    }) => updateCategory(id, name, parentId),
    onMutate: async ({ id, name, parentId }) => {
      await qc.cancelQueries({ queryKey: queryKeys.categories.all });
      const previousLists: [readonly unknown[], any][] = [];

      qc.getQueriesData({ queryKey: queryKeys.categories.all }).forEach(
        ([key, data]) => {
          if (Array.isArray(data)) {
            previousLists.push([key, data]);
            qc.setQueryData(
              key,
              data.map((c: any) =>
                c.id === id
                  ? { ...c, name, ...(parentId !== undefined ? { parent_id: parentId } : {}) }
                  : c
              )
            );
          }
        }
      );

      return { previousLists };
    },
    onError: (_err, _vars, context) => {
      context?.previousLists?.forEach(([key, data]) => {
        qc.setQueryData(key, data);
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.categories.all });
      const previousLists: [readonly unknown[], any][] = [];

      qc.getQueriesData({ queryKey: queryKeys.categories.all }).forEach(
        ([key, data]) => {
          if (Array.isArray(data)) {
            previousLists.push([key, data]);
            qc.setQueryData(
              key,
              data.filter((c: any) => c.id !== id)
            );
          }
        }
      );

      return { previousLists };
    },
    onError: (_err, _id, context) => {
      context?.previousLists?.forEach(([key, data]) => {
        qc.setQueryData(key, data);
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  });
}
