"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { STALE_TIME } from "@/lib/query-stale-times";
import {
  getTechnicians,
  getTechnician,
  getTechniciansStats,
  getTechnicianInventoryHistory,
  getTechnicianStockMovements,
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

export function useTechnicianHistory(techId: string) {
  return useQuery({
    queryKey: queryKeys.technicians.history(techId),
    queryFn: () => getTechnicianInventoryHistory(techId),
    enabled: !!techId,
  });
}

export function useTechnicianMovements(techId: string) {
  return useQuery({
    queryKey: queryKeys.technicians.movements(techId),
    queryFn: () => getTechnicianStockMovements(techId),
    enabled: !!techId,
  });
}
