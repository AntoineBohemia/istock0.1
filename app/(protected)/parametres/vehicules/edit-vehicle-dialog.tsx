"use client";

import { useState } from "react";
import { Car, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { useUpdateVehicle } from "@/hooks/mutations/use-vehicle-mutations";
import { useTechnicians } from "@/hooks/queries";
import { uploadVehiclePhoto } from "@/lib/supabase/queries/vehicles";
import { useOrganizationStore } from "@/lib/stores/organization-store";
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
  const { currentOrganization } = useOrganizationStore();
  // L'année sert à cibler la bonne fonction SQL (un appel sans année est ambigu)
  const { data: technicians = [] } = useTechnicians(
    currentOrganization?.id,
    new Date().getFullYear()
  );

  const [prevId, setPrevId] = useState(vehicle.id);
  const [licensePlate, setLicensePlate] = useState(vehicle.license_plate);
  const [brand, setBrand] = useState(vehicle.brand ?? "");
  const [model, setModel] = useState(vehicle.model ?? "");
  const [year, setYear] = useState(vehicle.year?.toString() ?? "");
  const [fuelType, setFuelType] = useState(vehicle.fuel_type ?? "");
  const [mileage, setMileage] = useState(vehicle.mileage?.toString() ?? "");
  const [notes, setNotes] = useState(vehicle.notes ?? "");
  const [technicianId, setTechnicianId] = useState(vehicle.technician_id ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(vehicle.photo_url);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);

  if (vehicle.id !== prevId) {
    setPrevId(vehicle.id);
    setLicensePlate(vehicle.license_plate);
    setBrand(vehicle.brand ?? "");
    setModel(vehicle.model ?? "");
    setYear(vehicle.year?.toString() ?? "");
    setFuelType(vehicle.fuel_type ?? "");
    setMileage(vehicle.mileage?.toString() ?? "");
    setNotes(vehicle.notes ?? "");
    setTechnicianId(vehicle.technician_id ?? "");
    setPhotoFile(null);
    setPhotoPreview(vehicle.photo_url);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand.trim() || !model.trim() || !licensePlate.trim()) return;

    // La photo part en premier : si l'envoi échoue, on n'enregistre pas une URL invalide
    let photoUrl = vehicle.photo_url;
    if (photoFile) {
      setIsSavingPhoto(true);
      try {
        photoUrl = await uploadVehiclePhoto(photoFile, vehicle.id);
      } catch {
        setIsSavingPhoto(false);
        toast.error("La photo n'a pas pu être envoyée");
        return;
      }
      setIsSavingPhoto(false);
    }

    updateMutation.mutate(
      {
        id: vehicle.id,
        photo_url: photoUrl,
        // Le titre du véhicule est toujours « marque modèle »
        name: `${brand.trim()} ${model.trim()}`,
        license_plate: licensePlate.trim().toUpperCase(),
        brand: brand.trim() || null,
        model: model.trim() || null,
        year: year ? parseInt(year) : null,
        fuel_type: fuelType || null,
        mileage: mileage ? parseInt(mileage) : null,
        notes: notes.trim() || null,
        technician_id: technicianId || null,
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
            {/* Photo du véhicule */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Photo</label>
              <label className="flex items-center gap-3 rounded-lg border border-dashed p-2 cursor-pointer hover:bg-muted/40 transition-colors">
                {photoPreview ? (
                  // Peut être une URL blob (aperçu local), non gérée par next/image
                  <img
                    src={photoPreview}
                    alt="Photo du véhicule"
                    className="size-14 rounded-md object-cover shrink-0"
                  />
                ) : (
                  <span className="flex size-14 items-center justify-center rounded-md bg-muted shrink-0">
                    <Car className="size-6 text-muted-foreground" />
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {photoFile ? photoFile.name : "Changer la photo (JPG, PNG, WebP)"}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setPhotoFile(file);
                    if (file) setPhotoPreview(URL.createObjectURL(file));
                  }}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Marque *
                </label>
                <Input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  required
                  autoFocus
                  className="bg-white dark:bg-card"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Modèle *
                </label>
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  required
                  className="bg-white dark:bg-card"
                />
              </div>
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
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Technicien assigné
              </label>
              <select
                value={technicianId}
                onChange={(e) => setTechnicianId(e.target.value)}
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
              disabled={updateMutation.isPending || isSavingPhoto}
              className="h-10 bg-white dark:bg-card"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={
                updateMutation.isPending ||
                isSavingPhoto ||
                !brand.trim() ||
                !model.trim() ||
                !licensePlate.trim()
              }
              className="h-10"
            >
              {(updateMutation.isPending || isSavingPhoto) && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
