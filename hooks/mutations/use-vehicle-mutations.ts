"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  createVehicle,
  updateVehicle,
  deleteVehicle,
  uploadVehicleDocument,
  deleteVehicleDocument,
  assignVehicle,
  type DocumentType,
} from "@/lib/supabase/queries/vehicles";

// ---------------------------------------------------------------------------
// Vehicle CRUD mutations
// ---------------------------------------------------------------------------

export function useCreateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      ...fields
    }: {
      organizationId: string;
      name: string;
      license_plate: string;
      brand?: string | null;
      model?: string | null;
      year?: number | null;
      vin?: string | null;
      fuel_type?: string | null;
      mileage?: number | null;
      technician_id?: string | null;
      notes?: string | null;
    }) => createVehicle(organizationId, fields),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.vehicles.all });
    },
  });
}

export function useUpdateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...fields
    }: {
      id: string;
      name?: string;
      license_plate?: string;
      brand?: string | null;
      model?: string | null;
      year?: number | null;
      vin?: string | null;
      fuel_type?: string | null;
      mileage?: number | null;
      technician_id?: string | null;
      notes?: string | null;
      photo_url?: string | null;
    }) => updateVehicle(id, fields),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.vehicles.all });
    },
  });
}

/**
 * Passation d'un vehicule : ferme la detention en cours et ouvre la suivante.
 * A preferer a useUpdateVehicle({ technician_id }) partout ou l'utilisateur
 * peut relever le compteur ou expliquer le changement.
 */
export function useAssignVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      vehicleId,
      technicianId,
      mileage,
      notes,
    }: {
      vehicleId: string;
      technicianId: string | null;
      mileage?: number | null;
      notes?: string | null;
    }) => assignVehicle(vehicleId, technicianId, mileage, notes),
    onSettled: () => {
      // L'historique des techniciens change aussi : on invalide tout l'arbre.
      qc.invalidateQueries({ queryKey: queryKeys.vehicles.all });
      qc.invalidateQueries({ queryKey: queryKeys.technicians.all });
    },
  });
}

export function useDeleteVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteVehicle(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.vehicles.all });
    },
  });
}

// ---------------------------------------------------------------------------
// Vehicle document mutations
// ---------------------------------------------------------------------------

export function useUploadVehicleDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      vehicleId,
      organizationId,
      documentType,
      metadata,
    }: {
      file: File;
      vehicleId: string;
      organizationId: string;
      documentType: DocumentType;
      metadata: { label: string; validFrom?: string; validUntil?: string };
    }) => uploadVehicleDocument(file, vehicleId, organizationId, documentType, metadata),
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({
        queryKey: queryKeys.vehicles.documents(vars.vehicleId, vars.documentType),
      });
      qc.invalidateQueries({ queryKey: queryKeys.vehicles.detail(vars.vehicleId) });
    },
  });
}

export function useDeleteVehicleDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      fileUrl,
      vehicleId,
      documentType,
    }: {
      id: string;
      fileUrl: string;
      vehicleId: string;
      documentType: DocumentType;
    }) => deleteVehicleDocument(id, fileUrl),
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({
        queryKey: queryKeys.vehicles.documents(vars.vehicleId, vars.documentType),
      });
      qc.invalidateQueries({ queryKey: queryKeys.vehicles.detail(vars.vehicleId) });
    },
  });
}
