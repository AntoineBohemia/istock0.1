"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useOrganizations } from "@/hooks/queries";
import { useUpdateTechnician } from "@/hooks/mutations";

interface TechnicianData {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  organization_id: string | null;
  tablet_ref: string | null;
  clothing_size: string | null;
  vehicle_plate: string | null;
  vehicle_brand: string | null;
  vehicle_model: string | null;
}

interface EditTechnicianModalProps {
  technician: TechnicianData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];

export default function EditTechnicianModal({
  technician,
  open,
  onOpenChange,
}: EditTechnicianModalProps) {
  const { currentOrganization } = useOrganizationStore();
  const { data: userOrgs } = useOrganizations();
  const updateMutation = useUpdateTechnician();
  const isMultiOrg = (userOrgs?.length ?? 0) > 1;

  const [prevId, setPrevId] = useState(technician.id);
  const [firstName, setFirstName] = useState(technician.first_name);
  const [lastName, setLastName] = useState(technician.last_name);
  const [email, setEmail] = useState(technician.email ?? "");
  const [phone, setPhone] = useState(technician.phone ?? "");
  const [city, setCity] = useState(technician.city ?? "");
  const [organizationId, setOrganizationId] = useState(technician.organization_id ?? "");
  const [tabletRef, setTabletRef] = useState(technician.tablet_ref ?? "");
  const [clothingSize, setClothingSize] = useState(technician.clothing_size ?? "");
  const [vehiclePlate, setVehiclePlate] = useState(technician.vehicle_plate ?? "");
  const [vehicleBrand, setVehicleBrand] = useState(technician.vehicle_brand ?? "");
  const [vehicleModel, setVehicleModel] = useState(technician.vehicle_model ?? "");

  if (technician.id !== prevId) {
    setPrevId(technician.id);
    setFirstName(technician.first_name);
    setLastName(technician.last_name);
    setEmail(technician.email ?? "");
    setPhone(technician.phone ?? "");
    setCity(technician.city ?? "");
    setOrganizationId(technician.organization_id ?? "");
    setTabletRef(technician.tablet_ref ?? "");
    setClothingSize(technician.clothing_size ?? "");
    setVehiclePlate(technician.vehicle_plate ?? "");
    setVehicleBrand(technician.vehicle_brand ?? "");
    setVehicleModel(technician.vehicle_model ?? "");
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;

    updateMutation.mutate(
      {
        id: technician.id,
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          city: city.trim() || null,
          organization_id: organizationId || currentOrganization?.id || undefined,
          tablet_ref: tabletRef.trim() || null,
          clothing_size: clothingSize || null,
          vehicle_plate: vehiclePlate.trim() || null,
          vehicle_brand: vehicleBrand.trim() || null,
          vehicle_model: vehicleModel.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Technicien modifie");
          onOpenChange(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 p-0 flex flex-col max-h-[85vh]">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-semibold">Modifier le technicien</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-5 py-3 border-t space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Prenom *
                </label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoFocus
                  className="bg-white dark:bg-card"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Nom *
                </label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="bg-white dark:bg-card"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Telephone
              </label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="06 12 34 56 78"
                className="bg-white dark:bg-card"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jean@example.com"
                className="bg-white dark:bg-card"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Departement
              </label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="77"
                className="bg-white dark:bg-card"
              />
            </div>

            {isMultiOrg && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Organisation
                </label>
                <select
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                  className="border-input bg-white dark:bg-card text-sm flex h-9 w-full rounded-md border px-3 py-1.5 outline-none focus:border-foreground/30 focus:ring-foreground/10 focus:ring-[3px]"
                >
                  {userOrgs?.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Plaque vehicule
                </label>
                <Input
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="AB-123-CD"
                  className="bg-white dark:bg-card font-mono uppercase"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Marque
                </label>
                <Input
                  value={vehicleBrand}
                  onChange={(e) => setVehicleBrand(e.target.value)}
                  placeholder="Renault"
                  className="bg-white dark:bg-card"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Modèle
                </label>
                <Input
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder="Kangoo"
                  className="bg-white dark:bg-card"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Ref. tablette
                </label>
                <Input
                  value={tabletRef}
                  onChange={(e) => setTabletRef(e.target.value)}
                  placeholder="Samsung Tab A8"
                  className="bg-white dark:bg-card"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Taille vetement
                </label>
                <select
                  value={clothingSize}
                  onChange={(e) => setClothingSize(e.target.value)}
                  className="border-input bg-white dark:bg-card text-sm flex h-9 w-full rounded-md border px-3 py-1.5 outline-none focus:border-foreground/30 focus:ring-foreground/10 focus:ring-[3px]"
                >
                  <option value="">—</option>
                  {CLOTHING_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
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
              disabled={updateMutation.isPending || !firstName.trim() || !lastName.trim()}
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
