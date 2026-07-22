"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { STALE_TIME } from "@/lib/query-stale-times";
import {
  getTechnicians,
  getTechnician,
  getTechnicianStockMovements,
  getTechnicianEvolutionData,
  getTechnicianYearlyTotals,
} from "@/lib/supabase/queries/technicians";

/**
 * Techniciens de toutes les societes du compte.
 *
 * `orgId` ne filtre plus : il conditionne seulement le declenchement de la
 * requete, le temps que la societe courante soit connue. Le RPC recoit NULL
 * et renvoie donc tout le monde.
 *
 * Filtrer sur la societe courante rendait invisibles les techniciens des
 * autres societes — celui de SEIREN n'apparaissait jamais depuis SMPR, et
 * rien ne signalait son existence. L'application se consulte d'un bloc ; ce
 * sont les ecrans d'action qui ciblent une societe.
 */
export function useTechnicians(orgId?: string, year?: number) {
  return useQuery({
    queryKey: queryKeys.technicians.list(undefined, year),
    queryFn: () => getTechnicians(undefined, year),
    enabled: !!orgId,
  });
}

export function useTechnician(id: string) {
  return useQuery({
    queryKey: queryKeys.technicians.detail(id),
    queryFn: () => getTechnician(id),
    enabled: !!id,
  });
}

export function useTechnicianMovements(techId: string) {
  return useQuery({
    queryKey: queryKeys.technicians.movements(techId),
    queryFn: () => getTechnicianStockMovements(techId),
    enabled: !!techId,
  });
}

export function useTechnicianEvolution(techId: string, months: number = 3) {
  return useQuery({
    queryKey: queryKeys.technicians.evolution(techId, months),
    queryFn: () => getTechnicianEvolutionData(techId, months),
    enabled: !!techId,
    staleTime: STALE_TIME.SLOW,
  });
}

export function useTechnicianYearlyTotals(techId: string, year: number) {
  return useQuery({
    queryKey: queryKeys.technicians.yearlyTotals(techId, year),
    queryFn: () => getTechnicianYearlyTotals(techId, year),
    enabled: !!techId,
    staleTime: STALE_TIME.MODERATE,
  });
}
