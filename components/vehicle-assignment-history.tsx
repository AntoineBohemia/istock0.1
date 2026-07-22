"use client";

import Link from "next/link";
import { Car, Gauge, History, User } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { VehicleAssignment } from "@/lib/supabase/queries/vehicles";

/**
 * Frise des periodes de detention.
 *
 * La meme donnee se lit dans les deux sens : sur une fiche vehicule on veut
 * savoir QUI l'a eu, sur une fiche technicien QUELS vehicules il a eus. D'ou
 * un seul composant et un `subject` qui dit quelle colonne porter en titre.
 */
interface VehicleAssignmentHistoryProps {
  assignments: VehicleAssignment[];
  isLoading?: boolean;
  /** "technician" : la fiche vehicule liste ses detenteurs. "vehicle" : l'inverse. */
  subject: "technician" | "vehicle";
}

const DAY = 86_400_000;

function daysBetween(from: string, to: string | null): number {
  const end = to ? new Date(to).getTime() : Date.now();
  return Math.max(0, Math.floor((end - new Date(from).getTime()) / DAY));
}

function formatDuration(days: number): string {
  if (days === 0) return "moins d'un jour";
  if (days === 1) return "1 jour";
  if (days < 31) return `${days} jours`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mois`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (rest === 0) return `${years} an${years > 1 ? "s" : ""}`;
  return `${years} an${years > 1 ? "s" : ""} et ${rest} mois`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`;
}

export default function VehicleAssignmentHistory({
  assignments,
  isLoading,
  subject,
}: VehicleAssignmentHistoryProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 flex items-start gap-3">
            <Skeleton className="size-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-card py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted mb-4">
          <History className="size-6 text-muted-foreground" />
        </div>
        <h3 className="font-heading font-semibold">Aucune passation enregistrée</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          {subject === "technician"
            ? "L'historique se remplira à la prochaine assignation de ce véhicule."
            : "Ce technicien n'a encore détenu aucun véhicule."}
        </p>
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {assignments.map((a) => {
        const isCurrent = a.released_at === null;
        const days = daysBetween(a.assigned_at, a.released_at);

        // Km parcourus : seulement quand les deux releves existent, sinon on
        // afficherait une difference calculee sur une valeur manquante.
        const drivenKm =
          a.mileage_start != null && a.mileage_end != null && a.mileage_end >= a.mileage_start
            ? a.mileage_end - a.mileage_start
            : null;

        const tech = a.technician;
        const vehicle = a.vehicle;

        return (
          <li
            key={a.id}
            className={cn(
              "rounded-xl border bg-card p-4",
              isCurrent && "border-primary/40 bg-primary/[0.03]"
            )}
          >
            <div className="flex items-start gap-3">
              {subject === "technician" ? (
                <Avatar className="size-9 shrink-0">
                  {tech?.photo_url && (
                    <AvatarImage
                      src={tech.photo_url}
                      alt={`${tech.first_name} ${tech.last_name}`}
                    />
                  )}
                  <AvatarFallback className="text-[11px] font-bold uppercase">
                    {tech ? initials(tech.first_name, tech.last_name) : "?"}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Car className="size-4 text-muted-foreground" />
                </span>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {subject === "technician" ? (
                      tech ? (
                        <Link
                          href={`/techniciens/${tech.id}`}
                          className="font-heading font-semibold text-sm hover:underline underline-offset-2"
                        >
                          {tech.first_name} {tech.last_name}
                        </Link>
                      ) : (
                        // Le technicien a ete supprime : la periode reste vraie.
                        <span className="font-heading font-semibold text-sm text-muted-foreground">
                          <User className="inline size-3.5 mr-1" />
                          Technicien supprimé
                        </span>
                      )
                    ) : vehicle ? (
                      <Link
                        href={`/vehicules/${vehicle.id}`}
                        className="font-heading font-semibold text-sm hover:underline underline-offset-2"
                      >
                        {vehicle.name}
                        <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                          {vehicle.license_plate}
                        </span>
                      </Link>
                    ) : (
                      <span className="font-heading font-semibold text-sm text-muted-foreground">
                        Véhicule supprimé
                      </span>
                    )}

                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(a.assigned_at)}
                      {" → "}
                      {a.released_at ? formatDate(a.released_at) : "aujourd'hui"}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    {isCurrent && (
                      <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        En cours
                      </span>
                    )}
                    <p className="text-xs font-medium tabular-nums mt-1">{formatDuration(days)}</p>
                  </div>
                </div>

                {(a.mileage_start != null || a.mileage_end != null) && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2 tabular-nums">
                    <Gauge className="size-3.5 shrink-0" />
                    {a.mileage_start != null
                      ? `${a.mileage_start.toLocaleString("fr-FR")} km`
                      : "relevé inconnu"}
                    {" → "}
                    {a.mileage_end != null
                      ? `${a.mileage_end.toLocaleString("fr-FR")} km`
                      : isCurrent
                        ? "en cours"
                        : "relevé inconnu"}
                    {drivenKm != null && (
                      <span className="font-medium text-foreground">
                        ({drivenKm.toLocaleString("fr-FR")} km parcourus)
                      </span>
                    )}
                  </p>
                )}

                {a.notes && <p className="text-sm mt-2 whitespace-pre-wrap">{a.notes}</p>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
