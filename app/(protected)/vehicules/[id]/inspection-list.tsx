"use client";

import { useState } from "react";
import { Calendar, ChevronDown, ClipboardCheck, Gauge, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useVehicleInspections } from "@/hooks/queries";
import {
  RATING_LABELS,
  type InspectionRating,
  type VehicleInspection,
} from "@/lib/supabase/queries/vehicle-inspections";

const RATING_BADGE: Record<InspectionRating, string> = {
  neuf: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  bon: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  correct: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  mauvais: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
};

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    time: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  };
}

/** Nombre de points « Mauvais » — le signal qui merite l'oeil en premier. */
function badCount(inspection: VehicleInspection): number {
  return inspection.items.filter((i) => i.rating === "mauvais").length;
}

function InspectionCard({
  inspection,
  defaultOpen,
}: {
  inspection: VehicleInspection;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { date, time } = formatDateTime(inspection.inspected_at);
  const bad = badCount(inspection);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ClipboardCheck className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium capitalize leading-tight">
            {date} · {time}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
            {inspection.author_name && (
              <span className="inline-flex items-center gap-1">
                <User className="size-3.5" />
                {inspection.author_name}
              </span>
            )}
            {inspection.mileage != null && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Gauge className="size-3.5" />
                {inspection.mileage.toLocaleString("fr-FR")} km
              </span>
            )}
            {inspection.driver_name && (
              <span className="truncate">Conducteur : {inspection.driver_name}</span>
            )}
          </p>
        </div>
        {bad > 0 && (
          <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-400">
            {bad} à corriger
          </span>
        )}
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t px-4 py-4">
          {/* La grille des points, comme sur la feuille papier. */}
          <div className="divide-y rounded-lg border">
            {inspection.items.map((item) => (
              <div key={item.key} className="flex items-start gap-3 px-3 py-2.5">
                <span className="min-w-0 flex-1 text-sm">
                  {item.label}
                  {item.comment && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {item.comment}
                    </span>
                  )}
                </span>
                {item.rating ? (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      RATING_BADGE[item.rating]
                    )}
                  >
                    {RATING_LABELS[item.rating]}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">—</span>
                )}
              </div>
            ))}
          </div>

          {inspection.photo_urls.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Photos
              </p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {inspection.photo_urls.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="aspect-square overflow-hidden rounded-lg border"
                  >
                    <img src={url} alt="" className="size-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {inspection.note && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Observation
              </p>
              <p className="whitespace-pre-wrap text-sm">{inspection.note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function InspectionList({ vehicleId }: { vehicleId: string }) {
  const { data: inspections = [], isLoading } = useVehicleInspections(vehicleId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  if (inspections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-14 text-center">
        <Calendar className="size-10 text-muted-foreground/30" />
        <p className="font-medium">Aucun état des lieux</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Les états des lieux se réalisent depuis le téléphone, dans les Actions rapides — écran
          Véhicules. Ils apparaîtront ici avec le jour, l&apos;heure, l&apos;auteur et le détail.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {inspections.map((inspection, i) => (
        <InspectionCard key={inspection.id} inspection={inspection} defaultOpen={i === 0} />
      ))}
    </div>
  );
}
