"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  getEquipmentProducts,
  getEquipmentProduct,
  getTechnicianEquipment,
  getAvailableEquipment,
  type EquipmentFilters,
} from "@/lib/supabase/queries/equipment";

export function useEquipmentProducts(filters: EquipmentFilters) {
  return useQuery({
    queryKey: queryKeys.equipment.list(filters),
    queryFn: () => getEquipmentProducts(filters),
    enabled: !!filters.organizationId,
    placeholderData: (prev) => prev,
  });
}

export function useEquipmentProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.equipment.detail(id),
    queryFn: () => getEquipmentProduct(id),
    enabled: !!id,
  });
}

export function useTechnicianEquipment(technicianId: string) {
  return useQuery({
    queryKey: queryKeys.equipment.byTechnician(technicianId),
    queryFn: () => getTechnicianEquipment(technicianId),
    enabled: !!technicianId,
  });
}

export function useAvailableEquipment(orgId?: string) {
  return useQuery({
    queryKey: queryKeys.equipment.available(orgId),
    queryFn: () => getAvailableEquipment(orgId!),
    enabled: !!orgId,
  });
}
