"use client";

import { useState } from "react";
import {
  Calendar,
  ChevronDown,
  ClipboardCheck,
  Download,
  Gauge,
  Loader2,
  Pencil,
  Trash2,
  User,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
import { useVehicleInspections, useDeleteVehicleInspection } from "@/hooks/queries";
import {
  RATING_LABELS,
  RATING_COLORS,
  type VehicleInspection,
} from "@/lib/supabase/queries/vehicle-inspections";
import EditInspectionDialog from "./edit-inspection-dialog";

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

/**
 * Force le telechargement d'une photo.
 *
 * L'attribut `download` d'un lien est ignore pour une URL d'un autre domaine
 * (le stockage Supabase) : le navigateur ouvre l'image au lieu de l'enregistrer.
 * On recupere donc l'image en blob, puis on declenche le telechargement depuis
 * une URL locale, ce qui respecte le nom de fichier voulu.
 */
async function downloadPhoto(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    // A defaut (blocage CORS...), on ouvre l'image : l'utilisateur peut
    // l'enregistrer a la main plutot que de rester bloque.
    window.open(url, "_blank", "noopener");
  }
}

/** Base du nom de fichier d'une photo : « etat-des-lieux-2026-07-24 ». */
function photoBaseName(iso: string): string {
  return `etat-des-lieux-${new Date(iso).toISOString().slice(0, 10)}`;
}

/** Extension deduite de l'URL, jpg par defaut. */
function photoExt(url: string): string {
  const m = url.split("?")[0].match(/\.([a-z0-9]{3,4})$/i);
  return m ? m[1] : "jpg";
}

function InspectionCard({
  inspection,
  vehicleId,
  defaultOpen,
}: {
  inspection: VehicleInspection;
  vehicleId: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteMutation = useDeleteVehicleInspection();
  const { date, time } = formatDateTime(inspection.inspected_at);
  const bad = badCount(inspection);

  const handleDelete = () => {
    deleteMutation.mutate(
      { id: inspection.id, vehicleId },
      {
        onSuccess: () => {
          toast.success("État des lieux supprimé");
          setDeleteOpen(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur"),
      }
    );
  };

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
                      RATING_COLORS[item.rating].badge
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
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Photos
                </p>
                {inspection.photo_urls.length > 1 && (
                  <button
                    onClick={() =>
                      inspection.photo_urls.forEach((url, i) =>
                        downloadPhoto(
                          url,
                          `${photoBaseName(inspection.inspected_at)}-${i + 1}.${photoExt(url)}`
                        )
                      )
                    }
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <Download className="size-3.5" />
                    Tout télécharger
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {inspection.photo_urls.map((url, i) => (
                  <div
                    key={url}
                    className="group relative aspect-square overflow-hidden rounded-lg border"
                  >
                    {/* Clic sur l'image = agrandir dans un onglet ; le bouton
                        dans le coin = telecharger le fichier. */}
                    <a href={url} target="_blank" rel="noreferrer" className="block size-full">
                      <img src={url} alt="" className="size-full object-cover" />
                    </a>
                    <button
                      onClick={() =>
                        downloadPhoto(
                          url,
                          `${photoBaseName(inspection.inspected_at)}-${i + 1}.${photoExt(url)}`
                        )
                      }
                      className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                      aria-label="Télécharger la photo"
                    >
                      <Download className="size-4" />
                    </button>
                  </div>
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

          {/* Modifier / supprimer : une correction reste possible apres coup. */}
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 size-4" />
              Modifier
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteOpen(true)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1.5 size-4" />
              Supprimer
            </Button>
          </div>
        </div>
      )}

      {editOpen && (
        <EditInspectionDialog
          inspection={inspection}
          vehicleId={vehicleId}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet état des lieux</AlertDialogTitle>
            <AlertDialogDescription>
              Le contrôle du {date} à {time} sera définitivement supprimé. Cette action est
              irréversible.
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
    <div className="space-y-4">
      {inspections.map((inspection, i) => (
        <InspectionCard
          key={inspection.id}
          inspection={inspection}
          vehicleId={vehicleId}
          defaultOpen={i === 0}
        />
      ))}
    </div>
  );
}
