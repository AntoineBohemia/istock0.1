"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUpdateVehicle } from "@/hooks/mutations/use-vehicle-mutations";
import { useTechnicians } from "@/hooks/queries";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import type { VehicleWithTechnician } from "@/lib/supabase/queries/vehicles";

interface AssignTechnicianDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: VehicleWithTechnician;
}

export default function AssignTechnicianDialog({
  open,
  onOpenChange,
  vehicle,
}: AssignTechnicianDialogProps) {
  const updateMutation = useUpdateVehicle();
  const { currentOrganization } = useOrganizationStore();
  // L'année cible la bonne fonction SQL (un appel sans année est ambigu)
  const { data: technicians = [] } = useTechnicians(
    currentOrganization?.id,
    new Date().getFullYear()
  );

  const [prevId, setPrevId] = useState(vehicle.id);
  const [technicianId, setTechnicianId] = useState(vehicle.technician_id ?? "");

  if (vehicle.id !== prevId) {
    setPrevId(vehicle.id);
    setTechnicianId(vehicle.technician_id ?? "");
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(
      { id: vehicle.id, technician_id: technicianId || null },
      {
        onSuccess: () => {
          toast.success(technicianId ? "Véhicule assigné" : "Assignation retirée");
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Erreur");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 p-0 flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-semibold">Assigner {vehicle.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="px-5 py-4 border-t">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Technicien
            </label>
            <select
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
              autoFocus
              className="h-9 w-full rounded-md border border-input bg-white dark:bg-card px-3 py-1 text-sm"
            >
              <option value="">Aucun technicien</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.first_name} {t.last_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t">
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
              className="h-10 bg-white dark:bg-card"
            >
              Annuler
            </Button>
            <Button type="submit" disabled={updateMutation.isPending} className="h-10">
              {updateMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
