"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { STALE_TIME } from "@/lib/query-stale-times";
import {
  getTechnicians,
  getTechnician,
  getTechniciansStats,
  getTechnicianStockMovements,
  getTechnicianEvolutionData,
  getTechnicianYearlyTotals,
} from "@/lib/supabase/queries/technicians";

export function useTechnicians(orgId?: string) {
  return useQuery({
    queryKey: queryKeys.technicians.list(orgId),
    queryFn: () => getTechnicians(orgId),
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

export function useTechniciansStats(orgId: string) {
  return useQuery({
    queryKey: queryKeys.technicians.stats(orgId),
    queryFn: () => getTechniciansStats(orgId),
    enabled: !!orgId,
    staleTime: STALE_TIME.MODERATE,
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
