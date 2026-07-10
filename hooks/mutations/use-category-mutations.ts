"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { createCategory, updateCategory, deleteCategory } from "@/lib/supabase/queries/categories";

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
      organizationId,
    }: {
      id: string;
      name: string;
      parentId?: string | null;
      organizationId?: string;
    }) => updateCategory(id, name, parentId, organizationId),
    onMutate: async ({ id, name, parentId }) => {
      await qc.cancelQueries({ queryKey: queryKeys.categories.all });
      const previousLists: [readonly unknown[], any][] = [];

      qc.getQueriesData({ queryKey: queryKeys.categories.all }).forEach(([key, data]) => {
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
      });

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
    mutationFn: ({ id, organizationId }: { id: string; organizationId?: string }) =>
      deleteCategory(id, organizationId),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: queryKeys.categories.all });
      const previousLists: [readonly unknown[], any][] = [];

      qc.getQueriesData({ queryKey: queryKeys.categories.all }).forEach(([key, data]) => {
        if (Array.isArray(data)) {
          previousLists.push([key, data]);
          qc.setQueryData(
            key,
            data.filter((c: any) => c.id !== id)
          );
        }
      });

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
