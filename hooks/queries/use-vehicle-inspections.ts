"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { STALE_TIME } from "@/lib/query-stale-times";
import {
  getVehicleInspections,
  createVehicleInspection,
  updateVehicleInspection,
  deleteVehicleInspection,
  type InspectionItem,
} from "@/lib/supabase/queries/vehicle-inspections";

export function useVehicleInspections(vehicleId?: string) {
  return useQuery({
    queryKey: queryKeys.vehicles.inspections(vehicleId ?? ""),
    queryFn: () => getVehicleInspections(vehicleId!),
    enabled: !!vehicleId,
    staleTime: STALE_TIME.SLOW,
  });
}

export function useCreateVehicleInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createVehicleInspection,
    onSuccess: (_id, params) => {
      qc.invalidateQueries({ queryKey: queryKeys.vehicles.inspections(params.vehicleId) });
      // Le km du vehicule a pu bouger : la fiche et la liste doivent suivre.
      qc.invalidateQueries({ queryKey: queryKeys.vehicles.detail(params.vehicleId) });
      qc.invalidateQueries({ queryKey: queryKeys.vehicles.lists() });
    },
  });
}

interface UpdateInspectionParams {
  id: string;
  vehicleId: string;
  driverName?: string | null;
  mileage?: number | null;
  items: InspectionItem[];
  photoUrls: string[];
  note?: string | null;
}

export function useUpdateVehicleInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...params }: UpdateInspectionParams) => updateVehicleInspection(id, params),
    onSuccess: (_data, params) => {
      qc.invalidateQueries({ queryKey: queryKeys.vehicles.inspections(params.vehicleId) });
    },
  });
}

export function useDeleteVehicleInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; vehicleId: string }) => deleteVehicleInspection(id),
    onSuccess: (_data, params) => {
      qc.invalidateQueries({ queryKey: queryKeys.vehicles.inspections(params.vehicleId) });
    },
  });
}
