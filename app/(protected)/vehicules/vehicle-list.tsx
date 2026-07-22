"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Car, ChevronRight, Fuel, Loader2, Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/lib/toast";

import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useVehicles } from "@/hooks/queries/use-vehicles";
import { useDeleteVehicle } from "@/hooks/mutations/use-vehicle-mutations";
import type { VehicleWithTechnician } from "@/lib/supabase/queries/vehicles";
import CreateVehicleDialog from "./create-vehicle-dialog";
import EditVehicleDialog from "./edit-vehicle-dialog";
import AssignTechnicianDialog from "./assign-technician-dialog";

const FUEL_LABELS: Record<string, string> = {
  diesel: "Diesel",
  essence: "Essence",
  electrique: "Électrique",
  hybride: "Hybride",
};

export default function VehicleList() {
  const orgId = useOrganizationStore((s) => s.currentOrganization?.id);
  const { data: vehicles = [], isLoading } = useVehicles(orgId);
  const deleteMutation = useDeleteVehicle();

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<VehicleWithTechnician | null>(null);
  const [assignVehicle, setAssignVehicle] = useState<VehicleWithTechnician | null>(null);
  const [deleteVehicle, setDeleteVehicle] = useState<VehicleWithTechnician | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return vehicles;
    const q = search.toLowerCase();
    return vehicles.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.license_plate.toLowerCase().includes(q) ||
        (v.brand ?? "").toLowerCase().includes(q)
    );
  }, [vehicles, search]);

  const handleDelete = () => {
    if (!deleteVehicle) return;
    deleteMutation.mutate(deleteVehicle.id, {
      onSuccess: () => {
        toast.success("Véhicule supprimé");
        setDeleteVehicle(null);
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Erreur lors de la suppression");
      },
    });
  };

  // La page n'est plus un onglet des paramètres : elle porte son propre titre
  // et son propre bouton d'ajout, comme Produits ou Outillage.
  const header = (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold tracking-tight">Véhicules</h1>
      <Button variant="outline-contrast" onClick={() => setCreateOpen(true)}>
        <Plus /> Ajouter un véhicule
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {header}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-card overflow-hidden flex flex-col">
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-10" />
                </div>
              </div>
              <div className="border-t px-3 py-2.5 flex items-center gap-2">
                <Skeleton className="size-6 rounded-full shrink-0" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}

      {vehicles.length > 3 && (
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Rechercher un véhicule..."
          className="bg-white dark:bg-card"
        />
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-muted mb-4">
            <Car className="size-6 text-muted-foreground" />
          </div>
          <h3 className="font-heading font-semibold">
            {search ? "Aucun véhicule trouvé" : "Aucun véhicule"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {search
              ? "Essayez un autre terme de recherche."
              : "Ajoutez votre premier véhicule pour gérer votre flotte."}
          </p>
          {!search && (
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 size-4" />
              Ajouter un véhicule
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((vehicle) => (
            <div
              key={vehicle.id}
              className="group rounded-xl border bg-card overflow-hidden flex flex-col transition-colors hover:border-primary/40"
            >
              <Link href={`/vehicules/${vehicle.id}`} className="block">
                {/* Photo — repère visuel principal */}
                <div className="relative aspect-[4/3] w-full bg-muted overflow-hidden">
                  {vehicle.photo_url ? (
                    <Image
                      src={vehicle.photo_url}
                      alt={vehicle.name}
                      fill
                      sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Car className="size-8 text-muted-foreground/25" />
                    </span>
                  )}
                  {vehicle.fuel_type && (
                    <span className="absolute top-1.5 right-1.5 flex items-center gap-1 text-[10px] font-medium rounded-full bg-background/90 backdrop-blur px-1.5 py-0.5">
                      <Fuel className="size-2.5" />
                      {FUEL_LABELS[vehicle.fuel_type] ?? vehicle.fuel_type}
                    </span>
                  )}
                </div>

                <div className="p-3">
                  <h3 className="font-heading font-semibold text-sm truncate group-hover:text-primary transition-colors">
                    {vehicle.name}
                  </h3>
                  <div className="flex items-baseline justify-between gap-2 mt-1">
                    <span className="text-xs font-mono tracking-wide truncate">
                      {vehicle.license_plate}
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums shrink-0">
                      {vehicle.year && <span>{vehicle.year}</span>}
                      {vehicle.mileage != null && vehicle.mileage > 0 && (
                        <span>{vehicle.mileage.toLocaleString("fr-FR")} km</span>
                      )}
                    </span>
                  </div>
                </div>
              </Link>

              {/* Assignation — cliquable, hors du lien vers la fiche */}
              <button
                type="button"
                onClick={() => setAssignVehicle(vehicle)}
                title={
                  vehicle.technician
                    ? "Changer le technicien"
                    : "Assigner un technicien à ce véhicule"
                }
                className={cn(
                  "mt-auto flex items-center gap-2 border-t px-3 py-2.5 text-left transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  vehicle.technician
                    ? "hover:bg-muted/60"
                    : "bg-primary/[0.04] hover:bg-primary/[0.09]"
                )}
              >
                {vehicle.technician ? (
                  <>
                    <Avatar className="size-6 shrink-0">
                      {vehicle.technician.photo_url && (
                        <AvatarImage
                          src={vehicle.technician.photo_url}
                          alt={`${vehicle.technician.first_name} ${vehicle.technician.last_name}`}
                        />
                      )}
                      <AvatarFallback className="text-[9px] font-bold uppercase">
                        {vehicle.technician.first_name.charAt(0)}
                        {vehicle.technician.last_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {vehicle.technician.first_name} {vehicle.technician.last_name}
                    </span>
                    <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </>
                ) : (
                  <>
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed border-primary/40">
                      <Plus className="size-3 text-primary" />
                    </span>
                    <span className="flex-1 truncate text-xs font-medium text-primary">
                      Assigner
                    </span>
                    <ChevronRight className="size-3.5 shrink-0 text-primary/60" />
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-center tabular-nums">
          {filtered.length} sur {vehicles.length} véhicule{vehicles.length > 1 ? "s" : ""}
        </p>
      )}

      <CreateVehicleDialog open={createOpen} onOpenChange={setCreateOpen} />

      {editVehicle && (
        <EditVehicleDialog
          open
          onOpenChange={(o) => !o && setEditVehicle(null)}
          vehicle={editVehicle}
        />
      )}

      {assignVehicle && (
        <AssignTechnicianDialog
          open
          onOpenChange={(o) => !o && setAssignVehicle(null)}
          vehicle={assignVehicle}
        />
      )}

      <AlertDialog open={!!deleteVehicle} onOpenChange={(o) => !o && setDeleteVehicle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce véhicule</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer {deleteVehicle?.name} ? Tous les documents associés
              seront également supprimés. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
