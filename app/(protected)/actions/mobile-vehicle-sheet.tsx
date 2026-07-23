"use client";

import { Car } from "lucide-react";

import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import type { VehicleWithTechnician } from "@/lib/supabase/queries/vehicles";
import { InsetGroup, InsetRow } from "./mobile-stack-screen";

/**
 * Liste de tous les vehicules, en feuille.
 *
 * Point d'entree du suivi d'etat des vehicules depuis l'ecran d'actions : on
 * ouvre, on choisit un vehicule. La suite (ce qu'on fait une fois dedans) se
 * branchera sur `onSelect`.
 */
export function MobileVehicleSheet({
  open,
  onOpenChange,
  vehicles,
  isLoading,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: VehicleWithTechnician[];
  isLoading: boolean;
  /** Action au clic sur un vehicule. Absente pour l'instant : la suite viendra. */
  onSelect?: (vehicle: VehicleWithTechnician) => void;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex max-h-[88vh] flex-col">
        <div className="shrink-0 px-4 pt-2 pb-3">
          <DrawerTitle className="font-heading text-2xl font-bold leading-tight">
            Véhicules
          </DrawerTitle>
          <p className="text-sm text-muted-foreground">
            {vehicles.length === 0
              ? "Aucun véhicule"
              : `${vehicles.length} véhicule${vehicles.length > 1 ? "s" : ""}`}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {isLoading && vehicles.length === 0 ? (
            <InsetGroup>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="size-10 shrink-0 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                  <Skeleton className="h-4 w-12 shrink-0" />
                </div>
              ))}
            </InsetGroup>
          ) : vehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Car className="size-12 text-muted-foreground/20" />
              <p className="text-base font-medium">Aucun véhicule</p>
              <p className="text-sm text-muted-foreground">
                Les véhicules se créent depuis l&apos;ordinateur, dans Véhicules.
              </p>
            </div>
          ) : (
            <InsetGroup>
              {vehicles.map((v) => {
                const detenteur = v.technician
                  ? `${v.technician.first_name} ${v.technician.last_name}`
                  : "Aucun détenteur";
                return (
                  <InsetRow
                    key={v.id}
                    onClick={onSelect ? () => onSelect(v) : undefined}
                    chevron={!!onSelect}
                    title={v.name || v.license_plate}
                    subtitle={`${v.license_plate} · ${detenteur}`}
                    leading={
                      v.photo_url ? (
                        <img
                          src={v.photo_url}
                          alt=""
                          className="size-10 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                          <Car className="size-5 text-muted-foreground" />
                        </span>
                      )
                    }
                    trailing={
                      v.mileage != null ? (
                        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                          {v.mileage.toLocaleString("fr-FR")} km
                        </span>
                      ) : undefined
                    }
                  />
                );
              })}
            </InsetGroup>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
