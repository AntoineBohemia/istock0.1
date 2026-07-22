"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/query-keys";

/**
 * Tables ecoutees et ce qu'un changement rend caduc.
 *
 * On invalide par racine et non par cle exacte : une entree de stock touche
 * la liste des produits, le journal, le tableau de bord et les achats. Viser
 * juste demanderait de reconstruire ici la logique de chaque ecran, et le
 * moindre oubli laisserait un chiffre faux — le defaut meme que ce mecanisme
 * doit corriger.
 */
const WATCHED: { table: string; invalidates: readonly (readonly string[])[] }[] = [
  {
    table: "stock_movements",
    invalidates: [
      queryKeys.movements.all,
      queryKeys.products.all,
      queryKeys.dashboard.all,
      queryKeys.technicians.all,
      queryKeys.equipment.all,
    ],
  },
  {
    table: "products",
    invalidates: [
      queryKeys.products.all,
      queryKeys.equipment.all,
      queryKeys.dashboard.all,
      queryKeys.inventory.all,
    ],
  },
  {
    table: "product_organization_stock",
    invalidates: [queryKeys.products.all, queryKeys.dashboard.all, queryKeys.inventory.all],
  },
  {
    table: "equipment_assignments",
    invalidates: [queryKeys.equipment.all, queryKeys.technicians.all],
  },
];

/**
 * Tient les ecrans a jour d'un appareil a l'autre.
 *
 * Une sortie saisie sur le telephone n'apparaissait sur le poste du bureau
 * qu'apres un rechargement manuel : deux personnes travaillant en meme temps
 * voyaient deux stocks differents, et rien ne signalait l'ecart.
 *
 * L'abonnement ne transporte pas les donnees : il annonce qu'une table a
 * change, et les requetes concernees sont refaites. C'est plus sur que
 * d'appliquer le contenu de l'evenement, qui court-circuiterait les regles
 * de lecture (jointures, filtres par societe, exclusion de l'outillage).
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    let pending: Set<string> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Une sortie par lot ecrit dix lignes d'affilee. Sans regroupement, dix
    // vagues de requetes partiraient pour un seul geste.
    const flush = () => {
      timer = null;
      const roots = pending;
      pending = null;
      if (!roots) return;
      for (const root of roots) {
        queryClient.invalidateQueries({ queryKey: JSON.parse(root) });
      }
    };

    const schedule = (roots: readonly (readonly string[])[]) => {
      pending ??= new Set();
      for (const root of roots) pending.add(JSON.stringify(root));
      if (timer) return;
      timer = setTimeout(flush, 250);
    };

    const channel = supabase.channel("istock-sync");
    for (const { table, invalidates } of WATCHED) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () =>
        schedule(invalidates)
      );
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
