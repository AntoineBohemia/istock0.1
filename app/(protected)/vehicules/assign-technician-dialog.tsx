"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAssignVehicle } from "@/hooks/mutations/use-vehicle-mutations";
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
  const assignMutation = useAssignVehicle();
  const { currentOrganization } = useOrganizationStore();
  // L'année cible la bonne fonction SQL (un appel sans année est ambigu)
  const { data: technicians = [] } = useTechnicians(
    currentOrganization?.id,
    new Date().getFullYear()
  );

  const [prevId, setPrevId] = useState(vehicle.id);
  const [technicianId, setTechnicianId] = useState(vehicle.technician_id ?? "");
  const [mileage, setMileage] = useState("");
  const [notes, setNotes] = useState("");

  if (vehicle.id !== prevId) {
    setPrevId(vehicle.id);
    setTechnicianId(vehicle.technician_id ?? "");
    setMileage("");
    setNotes("");
  }

  const lastMileage = vehicle.mileage ?? 0;
  const parsedMileage = mileage.trim() === "" ? null : Number(mileage);
  // Un compteur ne recule pas. La base refuse de toute façon, autant le dire
  // avant l'aller-retour.
  const mileageError =
    parsedMileage !== null && (!Number.isFinite(parsedMileage) || parsedMileage < 0)
      ? "Kilométrage invalide"
      : parsedMileage !== null && parsedMileage < lastMileage
        ? `Inférieur au dernier relevé (${lastMileage.toLocaleString("fr-FR")} km)`
        : null;

  const isHandover = (vehicle.technician_id ?? "") !== technicianId;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mileageError) return;
    assignMutation.mutate(
      {
        vehicleId: vehicle.id,
        technicianId: technicianId || null,
        mileage: parsedMileage,
        notes: notes || null,
      },
      {
        onSuccess: () => {
          toast.success(technicianId ? "Véhicule assigné" : "Assignation retirée");
          setMileage("");
          setNotes("");
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
          <div className="px-5 py-4 border-t space-y-4">
            <div>
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
              {vehicle.technician && isHandover && (
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {vehicle.technician.first_name} {vehicle.technician.last_name} rend le véhicule.
                  La période en cours sera clôturée.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="assign-mileage"
                className="text-xs font-medium text-muted-foreground mb-1 block"
              >
                Kilométrage à la remise
              </label>
              <Input
                id="assign-mileage"
                type="number"
                inputMode="numeric"
                min={lastMileage}
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                placeholder={lastMileage ? lastMileage.toLocaleString("fr-FR") : "0"}
                className="bg-white dark:bg-card"
              />
              {mileageError ? (
                <p className="text-[11px] text-destructive mt-1.5">{mileageError}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Facultatif. C&apos;est ce relevé qui permettra de dire combien de kilomètres
                  chacun a parcourus.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="assign-notes"
                className="text-xs font-medium text-muted-foreground mb-1 block"
              >
                Commentaire
              </label>
              <Textarea
                id="assign-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Retour pour congés, véhicule immobilisé, rayure constatée…"
                className="bg-white dark:bg-card"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t">
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={assignMutation.isPending}
              className="h-10 bg-white dark:bg-card"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={assignMutation.isPending || !!mileageError}
              className="h-10"
            >
              {assignMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
