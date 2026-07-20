"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { useUpdateVehicle } from "@/hooks/mutations/use-vehicle-mutations";
import type { VehicleWithTechnician } from "@/lib/supabase/queries/vehicles";

interface EditVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: VehicleWithTechnician;
}

const FUEL_OPTIONS = [
  { value: "", label: "Non renseigné" },
  { value: "diesel", label: "Diesel" },
  { value: "essence", label: "Essence" },
  { value: "electrique", label: "Électrique" },
  { value: "hybride", label: "Hybride" },
] as const;

export default function EditVehicleDialog({ open, onOpenChange, vehicle }: EditVehicleDialogProps) {
  const updateMutation = useUpdateVehicle();

  const [prevId, setPrevId] = useState(vehicle.id);
  const [name, setName] = useState(vehicle.name);
  const [licensePlate, setLicensePlate] = useState(vehicle.license_plate);
  const [brand, setBrand] = useState(vehicle.brand ?? "");
  const [model, setModel] = useState(vehicle.model ?? "");
  const [year, setYear] = useState(vehicle.year?.toString() ?? "");
  const [fuelType, setFuelType] = useState(vehicle.fuel_type ?? "");
  const [mileage, setMileage] = useState(vehicle.mileage?.toString() ?? "");
  const [notes, setNotes] = useState(vehicle.notes ?? "");

  if (vehicle.id !== prevId) {
    setPrevId(vehicle.id);
    setName(vehicle.name);
    setLicensePlate(vehicle.license_plate);
    setBrand(vehicle.brand ?? "");
    setModel(vehicle.model ?? "");
    setYear(vehicle.year?.toString() ?? "");
    setFuelType(vehicle.fuel_type ?? "");
    setMileage(vehicle.mileage?.toString() ?? "");
    setNotes(vehicle.notes ?? "");
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !licensePlate.trim()) return;

    updateMutation.mutate(
      {
        id: vehicle.id,
        name: name.trim(),
        license_plate: licensePlate.trim().toUpperCase(),
        brand: brand.trim() || null,
        model: model.trim() || null,
        year: year ? parseInt(year) : null,
        fuel_type: fuelType || null,
        mileage: mileage ? parseInt(mileage) : null,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("Véhicule mis à jour");
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
          <DialogTitle className="text-base font-semibold">Modifier le véhicule</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="px-5 py-3 border-t space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nom *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                className="bg-white dark:bg-card"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Immatriculation *
              </label>
              <Input
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                required
                className="bg-white dark:bg-card font-mono tracking-wide uppercase"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Marque
                </label>
                <Input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="bg-white dark:bg-card"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Modèle
                </label>
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="bg-white dark:bg-card"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Année
                </label>
                <Input
                  type="number"
                  min={1900}
                  max={2100}
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="bg-white dark:bg-card"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Kilométrage
                </label>
                <Input
                  type="number"
                  min={0}
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  className="bg-white dark:bg-card"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Carburant
                </label>
                <select
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-white dark:bg-card px-3 py-1 text-sm"
                >
                  {FUEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes internes"
                className="bg-white dark:bg-card"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 px-5 py-4 border-t">
            <div className="flex-1" />
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
              className="h-10 bg-white dark:bg-card"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending || !name.trim() || !licensePlate.trim()}
              className="h-10"
            >
              {updateMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
