"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Car, Fuel, Loader2, Plus, User } from "lucide-react";

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

const FUEL_LABELS: Record<string, string> = {
  diesel: "Diesel",
  essence: "Essence",
  electrique: "Électrique",
  hybride: "Hybride",
};

export default function VehiclesPage() {
  const orgId = useOrganizationStore((s) => s.currentOrganization?.id);
  const { data: vehicles = [], isLoading } = useVehicles(orgId);
  const deleteMutation = useDeleteVehicle();

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<VehicleWithTechnician | null>(null);
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-2 min-w-0 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const actionSlot =
    typeof document !== "undefined" ? document.getElementById("settings-action-slot") : null;

  return (
    <div className="space-y-4">
      {actionSlot &&
        createPortal(
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" />
            Ajouter un véhicule
          </Button>,
          actionSlot
        )}

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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((vehicle) => (
            <Link
              key={vehicle.id}
              href={`/vehicules/${vehicle.id}`}
              className="group rounded-xl border bg-card p-4 flex flex-col gap-2 transition-all hover:border-primary/40 active:scale-[0.98]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-heading font-semibold text-sm truncate group-hover:text-primary transition-colors">
                    {vehicle.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono tracking-wide">
                    {vehicle.license_plate}
                  </p>
                </div>
                {vehicle.fuel_type && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 rounded-full bg-foreground/[0.06] px-2 py-0.5">
                    <Fuel className="size-3" />
                    {FUEL_LABELS[vehicle.fuel_type] ?? vehicle.fuel_type}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {vehicle.brand && (
                  <span>
                    {vehicle.brand}
                    {vehicle.model ? ` ${vehicle.model}` : ""}
                    {vehicle.year ? ` (${vehicle.year})` : ""}
                  </span>
                )}
                {vehicle.mileage != null && vehicle.mileage > 0 && (
                  <span className="tabular-nums">{vehicle.mileage.toLocaleString("fr-FR")} km</span>
                )}
              </div>

              {vehicle.technician && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                  <User className="size-3 shrink-0" />
                  <span className="truncate">
                    {vehicle.technician.first_name} {vehicle.technician.last_name}
                  </span>
                </div>
              )}
            </Link>
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
