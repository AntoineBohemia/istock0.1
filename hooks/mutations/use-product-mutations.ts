"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  createProduct,
  updateProduct,
  archiveProduct,
  unarchiveProduct,
  type CreateProductData,
  type UpdateProductData,
  type ProductsResult,
} from "@/lib/supabase/queries/products";

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProductData) => createProduct(data),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.products.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.products.stats() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      // L'outillage, ce sont des produits (product_type = 'equipment') mais son
      // cache vit sous une autre cle. Sans ceci, l'ecran Outillage garde l'ancienne valeur.
      qc.invalidateQueries({ queryKey: queryKeys.equipment.all });
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductData }) => updateProduct(id, data),
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
    onSettled: (_data, _err, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.products.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.products.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.products.stats() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      qc.invalidateQueries({ queryKey: queryKeys.equipment.all });
    },
  });
}

export function useArchiveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveProduct(id),
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
      qc.invalidateQueries({ queryKey: queryKeys.products.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.products.stats() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      qc.invalidateQueries({ queryKey: queryKeys.equipment.all });
    },
  });
}

/**
 * Remet un produit au catalogue.
 *
 * Symetrique de useArchiveProduct : la fiche disparait de la vue « archives »
 * des le clic, et reparait dans le catalogue actif. La requete efface aussi le
 * motif — il decrit une sortie du catalogue, il n'a plus de sens au retour.
 */
export function useUnarchiveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unarchiveProduct(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.products.lists() });
      const previousLists: [readonly unknown[], ProductsResult | undefined][] = [];

      // Retrait optimiste de toutes les listes affichees : celle des archives
      // est la seule ou la fiche figure, elle en sort aussitot.
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
      qc.invalidateQueries({ queryKey: queryKeys.products.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.products.stats() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      qc.invalidateQueries({ queryKey: queryKeys.equipment.all });
    },
  });
}
