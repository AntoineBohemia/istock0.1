"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { STALE_TIME } from "@/lib/query-stale-times";
import {
  getVehicles,
  getVehicle,
  getVehicleDocuments,
  getVehicleAssignments,
  getTechnicianVehicleHistory,
  type DocumentType,
  type VehicleDocument,
} from "@/lib/supabase/queries/vehicles";

export function useVehicles(orgId?: string) {
  return useQuery({
    queryKey: queryKeys.vehicles.list(orgId),
    queryFn: () => getVehicles(orgId),
    enabled: !!orgId,
    staleTime: STALE_TIME.SLOW,
  });
}

export function useVehicle(id?: string) {
  return useQuery({
    queryKey: queryKeys.vehicles.detail(id!),
    queryFn: () => getVehicle(id!),
    enabled: !!id,
    staleTime: STALE_TIME.SLOW,
  });
}

/** Qui a detenu ce vehicule, periode en cours comprise. */
export function useVehicleAssignments(vehicleId?: string) {
  return useQuery({
    queryKey: queryKeys.vehicles.assignments(vehicleId!),
    queryFn: () => getVehicleAssignments(vehicleId!),
    enabled: !!vehicleId,
    staleTime: STALE_TIME.SLOW,
  });
}

/** Quels vehicules ce technicien a detenus. */
export function useTechnicianVehicleHistory(technicianId?: string) {
  return useQuery({
    queryKey: queryKeys.vehicles.technicianHistory(technicianId!),
    queryFn: () => getTechnicianVehicleHistory(technicianId!),
    enabled: !!technicianId,
    staleTime: STALE_TIME.SLOW,
  });
}

export function useVehicleDocuments(
  vehicleId: string,
  documentType?: DocumentType,
  options?: { initialData?: VehicleDocument[] }
) {
  return useQuery({
    queryKey: queryKeys.vehicles.documents(vehicleId, documentType),
    queryFn: () => getVehicleDocuments(vehicleId, documentType),
    enabled: !!vehicleId,
    staleTime: STALE_TIME.REALTIME,
    initialData: options?.initialData,
  });
}
