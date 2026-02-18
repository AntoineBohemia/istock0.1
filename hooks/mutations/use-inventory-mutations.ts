"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  restockTechnician,
  addToTechnicianInventory,
  type RestockItem,
} from "@/lib/supabase/queries/inventory";

export function useRestockTechnician() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      technicianId,
      items,
    }: {
      technicianId: string;
      items: RestockItem[];
    }) => restockTechnician(technicianId, items),
    onSettled: (_data, _err, params) => {
      // Technicien : tout change (list, detail, inventory, history)
      qc.invalidateQueries({ queryKey: queryKeys.technicians.all });
      // Produits : listes (stock change) + details des produits concernes
      qc.invalidateQueries({ queryKey: queryKeys.products.lists() });
      params.items.forEach((item) => {
        qc.invalidateQueries({
          queryKey: queryKeys.products.detail(item.productId),
        });
      });
      // Mouvements : nouvelles entrees creees
      qc.invalidateQueries({ queryKey: queryKeys.movements.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.movements.summary() });
      // Dashboard : stats (prefix sans orgId pour matcher toutes les orgs)
      qc.invalidateQueries({ queryKey: [...queryKeys.dashboard.all, "stats"] });
      // Inventaire dispo
      qc.invalidateQueries({ queryKey: queryKeys.inventory.all });
    },
  });
}

export function useAddToTechnicianInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      technicianId,
      items,
    }: {
      technicianId: string;
      items: RestockItem[];
    }) => addToTechnicianInventory(technicianId, items),
    onSettled: (_data, _err, params) => {
      // Technicien : tout change (list, detail, inventory, history)
      qc.invalidateQueries({ queryKey: queryKeys.technicians.all });
      // Produits : listes (stock change) + details des produits concernes
      qc.invalidateQueries({ queryKey: queryKeys.products.lists() });
      params.items.forEach((item) => {
        qc.invalidateQueries({
          queryKey: queryKeys.products.detail(item.productId),
        });
      });
      // Mouvements : nouvelles entrees creees
      qc.invalidateQueries({ queryKey: queryKeys.movements.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.movements.summary() });
      // Dashboard : stats (prefix sans orgId pour matcher toutes les orgs)
      qc.invalidateQueries({ queryKey: [...queryKeys.dashboard.all, "stats"] });
      // Inventaire dispo
      qc.invalidateQueries({ queryKey: queryKeys.inventory.all });
    },
  });
}
