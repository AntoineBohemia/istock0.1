"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  type CreateProductData,
  type UpdateProductData,
  type ProductsResult,
} from "@/lib/supabase/queries/products";

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProductData) => createProduct(data),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.products.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductData }) =>
      updateProduct(id, data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: queryKeys.products.detail(id) });
      const previous = qc.getQueryData(queryKeys.products.detail(id));
      qc.setQueryData(queryKeys.products.detail(id), (old: any) =>
        old ? { ...old, ...data } : old
      );
      return { previous };
    },
    onError: (_err, { id }, context) => {
      if (context?.previous) {
        qc.setQueryData(queryKeys.products.detail(id), context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.products.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.products.lists() });
      const previousLists: [readonly unknown[], ProductsResult | undefined][] = [];

      // Snapshot and optimistically remove from all product list caches
      qc.getQueriesData<ProductsResult>({ queryKey: queryKeys.products.lists() }).forEach(
        ([key, data]) => {
          if (data) {
            previousLists.push([key, data]);
            qc.setQueryData(key, {
              ...data,
              products: data.products.filter((p) => p.id !== id),
              total: data.total - 1,
            });
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
      qc.invalidateQueries({ queryKey: queryKeys.products.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
