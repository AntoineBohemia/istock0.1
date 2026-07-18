"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { STALE_TIME } from "@/lib/query-stale-times";
import {
  getVehicles,
  getVehicle,
  getVehicleDocuments,
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
