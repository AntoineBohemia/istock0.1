"use client";

import { Car, ChevronRight, Gauge, User } from "lucide-react";

import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { VehicleWithTechnician } from "@/lib/supabase/queries/vehicles";

/**
 * Liste de tous les vehicules, en feuille.
 *
 * Point d'entree du controle hebdomadaire : on ouvre, on choisit un vehicule,
 * on enchaine sur son etat des lieux (`onSelect`). Chaque vehicule est une
 * carte pleine largeur — assez grande pour viser au pouce, et qui donne d'un
 * coup d'oeil ce qui compte : detenteur et kilometrage.
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
            {vehicles.length === 0 ? "Aucun véhicule" : "Choisissez un véhicule à contrôler"}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {isLoading && vehicles.length === 0 ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl border p-3">
                <Skeleton className="size-14 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))
          ) : vehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Car className="size-12 text-muted-foreground/20" />
              <p className="text-base font-medium">Aucun véhicule</p>
              <p className="text-sm text-muted-foreground">
                Les véhicules se créent depuis l&apos;ordinateur, dans Véhicules.
              </p>
            </div>
          ) : (
            vehicles.map((v) => {
              const detenteur = v.technician
                ? `${v.technician.first_name} ${v.technician.last_name}`
                : null;
              return (
                <button
                  key={v.id}
                  onClick={onSelect ? () => onSelect(v) : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border bg-white p-3 text-left transition-transform dark:bg-card",
                    onSelect && "active:scale-[0.98]"
                  )}
                >
                  {/* Photo ou pastille : le vehicule se reconnait avant de lire. */}
                  {v.photo_url ? (
                    <img
                      src={v.photo_url}
                      alt=""
                      className="size-14 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Car className="size-7" />
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold leading-tight">
                      {v.name || v.license_plate}
                    </p>
                    <p className="truncate font-mono text-sm text-muted-foreground">
                      {v.license_plate}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-sm",
                          detenteur ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        <User className="size-3.5 shrink-0" />
                        <span className="truncate">{detenteur ?? "Aucun détenteur"}</span>
                      </span>
                      {v.mileage != null && (
                        <span className="inline-flex items-center gap-1 text-sm tabular-nums text-muted-foreground">
                          <Gauge className="size-3.5 shrink-0" />
                          {v.mileage.toLocaleString("fr-FR")} km
                        </span>
                      )}
                    </div>
                  </div>

                  {onSelect && (
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground/40" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
