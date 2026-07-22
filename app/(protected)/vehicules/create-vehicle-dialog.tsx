"use client";

import { useState } from "react";
import { Car, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useCreateVehicle, useUpdateVehicle } from "@/hooks/mutations/use-vehicle-mutations";
import { useTechnicians } from "@/hooks/queries";
import { uploadVehiclePhoto } from "@/lib/supabase/queries/vehicles";

interface CreateVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FUEL_OPTIONS = [
  { value: "", label: "Non renseigné" },
  { value: "diesel", label: "Diesel" },
  { value: "essence", label: "Essence" },
  { value: "electrique", label: "Électrique" },
  { value: "hybride", label: "Hybride" },
] as const;

export default function CreateVehicleDialog({ open, onOpenChange }: CreateVehicleDialogProps) {
  const { currentOrganization } = useOrganizationStore();
  const createMutation = useCreateVehicle();
  const updateMutation = useUpdateVehicle();
  // L'année sert à cibler la bonne fonction SQL (un appel sans année est ambigu)
  const { data: technicians = [] } = useTechnicians(
    currentOrganization?.id,
    new Date().getFullYear()
  );

  const [prevOpen, setPrevOpen] = useState(open);
  const [licensePlate, setLicensePlate] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [mileage, setMileage] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);

  if (open && !prevOpen) {
    setLicensePlate("");
    setBrand("");
    setModel("");
    setYear("");
    setFuelType("");
    setMileage("");
    setTechnicianId("");
    setPhotoFile(null);
    setPhotoPreview(null);
  }
  if (open !== prevOpen) setPrevOpen(open);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand.trim() || !model.trim() || !licensePlate.trim() || !currentOrganization?.id) return;

    createMutation.mutate(
      {
        organizationId: currentOrganization.id,
        // Le titre du véhicule est toujours « marque modèle »
        name: `${brand.trim()} ${model.trim()}`,
        license_plate: licensePlate.trim().toUpperCase(),
        brand: brand.trim() || null,
        model: model.trim() || null,
        year: year ? parseInt(year) : null,
        fuel_type: fuelType || null,
        mileage: mileage ? parseInt(mileage) : null,
        technician_id: technicianId || null,
      },
      {
        // La photo ne peut être envoyée qu'après création : elle a besoin de l'id
        onSuccess: async (vehicle) => {
          if (!photoFile) {
            toast.success("Véhicule ajouté");
            onOpenChange(false);
            return;
          }
          setIsSavingPhoto(true);
          try {
            const url = await uploadVehiclePhoto(photoFile, vehicle.id);
            await updateMutation.mutateAsync({ id: vehicle.id, photo_url: url });
            toast.success("Véhicule ajouté");
          } catch {
            toast.error("Véhicule créé, mais la photo n'a pas pu être envoyée");
          } finally {
            setIsSavingPhoto(false);
            onOpenChange(false);
          }
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
          <DialogTitle className="text-base font-semibold">Nouveau véhicule</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="px-5 py-3 border-t space-y-3">
            {/* Photo du véhicule */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Photo</label>
              <label className="flex items-center gap-3 rounded-lg border border-dashed p-2 cursor-pointer hover:bg-muted/40 transition-colors">
                {photoPreview ? (
                  // Aperçu local : URL blob, non gérée par next/image
                  <img
                    src={photoPreview}
                    alt="Aperçu du véhicule"
                    className="size-14 rounded-md object-cover shrink-0"
                  />
                ) : (
                  <span className="flex size-14 items-center justify-center rounded-md bg-muted shrink-0">
                    <Car className="size-6 text-muted-foreground" />
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {photoFile ? photoFile.name : "Choisir une photo (JPG, PNG, WebP)"}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setPhotoFile(file);
                    setPhotoPreview(file ? URL.createObjectURL(file) : null);
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
                  placeholder="Renault"
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
                  placeholder="Master"
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
                placeholder="AB-123-CD"
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
                  placeholder="2024"
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
                  placeholder="0"
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
          </div>

          <div className="flex items-center gap-3 px-5 py-4 border-t">
            <div className="flex-1" />
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending || isSavingPhoto}
              className="h-10 bg-white dark:bg-card"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={
                createMutation.isPending ||
                isSavingPhoto ||
                !brand.trim() ||
                !model.trim() ||
                !licensePlate.trim()
              }
              className="h-10"
            >
              {(createMutation.isPending || isSavingPhoto) && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Ajouter
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
