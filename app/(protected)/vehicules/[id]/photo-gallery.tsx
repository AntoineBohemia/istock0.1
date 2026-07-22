"use client";

import { useState } from "react";
import { Camera, Download, Loader2, Trash2, Upload } from "lucide-react";

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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";

import { useVehicleDocuments } from "@/hooks/queries/use-vehicles";
import { useDeleteVehicleDocument } from "@/hooks/mutations/use-vehicle-mutations";
import type { VehicleDocument } from "@/lib/supabase/queries/vehicles";
import UploadDocumentDialog from "./upload-document-dialog";

/**
 * Galerie photo d'un vehicule.
 *
 * Les photos passaient par la liste de documents commune : une ligne, une
 * icone generique, un nom de fichier. On ne voyait donc jamais la photo — or
 * c'est tout ce qu'on vient y chercher. Le type `photo` etait pourtant
 * documente comme « la galerie d'etat du vehicule (historique date) ».
 *
 * Ici l'image est le sujet, et sa date d'ajout la legende : c'est elle qui
 * donne son sens a la serie — l'etat du vehicule a tel moment.
 */
function formatUploadDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatUploadTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Nom de fichier au telechargement : la date d'abord.
 *
 * Les photos arrivent du telephone avec des noms comme « IMG_4821.jpg ».
 * Telechargees en serie, elles deviennent impossibles a distinguer. Prefixer
 * par la date les range dans l'ordre chronologique dans le dossier.
 */
function downloadName(photo: VehicleDocument): string {
  const ext = photo.file_name.match(/\.[^.]+$/)?.[0] ?? ".jpg";
  const d = new Date(photo.created_at);
  const stamp = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
  return `photo-vehicule-${stamp}${ext}`;
}

/**
 * Telechargement force.
 *
 * L'attribut `download` d'une balise <a> est ignore quand le fichier vient
 * d'une autre origine — ici le stockage Supabase. Le clic ouvrait donc un
 * onglet au lieu d'enregistrer. On recupere le fichier puis on declenche le
 * telechargement depuis une URL locale, ou l'attribut est respecte.
 */
async function downloadPhoto(photo: VehicleDocument) {
  try {
    const response = await fetch(photo.file_url);
    if (!response.ok) throw new Error(String(response.status));
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadName(photo);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    // Echec du telechargement : on ouvre la photo plutot que de ne rien faire,
    // l'utilisateur peut toujours l'enregistrer a la main.
    toast.error("Téléchargement impossible, la photo s'ouvre dans un onglet");
    window.open(photo.file_url, "_blank", "noopener");
  }
}

export default function PhotoGallery({
  vehicleId,
  organizationId,
}: {
  vehicleId: string;
  organizationId: string;
}) {
  const { data: photos = [], isLoading } = useVehicleDocuments(vehicleId, "photo");
  const deleteMutation = useDeleteVehicleDocument();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [preview, setPreview] = useState<VehicleDocument | null>(null);
  const [toDelete, setToDelete] = useState<VehicleDocument | null>(null);

  const handleDelete = () => {
    if (!toDelete) return;
    deleteMutation.mutate(
      { id: toDelete.id, fileUrl: toDelete.file_url, vehicleId, documentType: "photo" },
      {
        onSuccess: () => {
          toast.success("Photo supprimée");
          setToDelete(null);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur"),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="aspect-[4/3] animate-pulse rounded-xl bg-muted" />
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {photos.length} photo{photos.length > 1 ? "s" : ""}
        </p>
        <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="mr-1.5 size-4" />
          Ajouter
        </Button>
      </div>

      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted">
            <Camera className="size-5 text-muted-foreground" />
          </div>
          <h3 className="font-heading text-sm font-semibold">Aucune photo</h3>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Gardez une trace datée de l&apos;état du véhicule dans le temps.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setUploadOpen(true)}>
            <Upload className="mr-1.5 size-4" />
            Ajouter une photo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <figure key={photo.id} className="group space-y-2">
              <button
                type="button"
                onClick={() => setPreview(photo)}
                className="relative block w-full overflow-hidden rounded-xl border bg-muted transition-transform active:scale-[0.98]"
              >
                {/* Rapport fixe : des photos de formats differents alignent
                    leurs cadres, et la grille ne saute pas au chargement. */}
                <span className="block aspect-[4/3]">
                  <img
                    src={photo.file_url}
                    alt={photo.label}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                </span>
                {/* Telecharger et supprimer, au survol. Le telechargement
                    etait relegue a l'apercu : il fallait ouvrir la photo pour
                    l'enregistrer, alors que c'est souvent tout ce qu'on veut
                    en faire. */}
                <span className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadPhoto(photo);
                    }}
                    role="button"
                    aria-label="Télécharger la photo"
                    className="flex size-8 items-center justify-center rounded-lg bg-black/55 text-white hover:bg-black/75"
                  >
                    <Download className="size-4" />
                  </span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setToDelete(photo);
                    }}
                    role="button"
                    aria-label="Supprimer la photo"
                    className="flex size-8 items-center justify-center rounded-lg bg-black/55 text-white hover:bg-black/75"
                  >
                    <Trash2 className="size-4" />
                  </span>
                </span>
              </button>

              {/* La date fait la legende : sans elle une serie de photos ne
                  raconte rien, avec elle c'est un historique. */}
              <figcaption className="px-0.5">
                <p className="text-sm font-medium leading-tight">
                  {formatUploadDate(photo.created_at)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatUploadTime(photo.created_at)}
                  {photo.label && photo.label !== photo.file_name ? ` · ${photo.label}` : ""}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {/* Aperçu plein écran */}
      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0">
          <DialogTitle className="px-5 pt-4 text-base font-semibold">
            {preview ? formatUploadDate(preview.created_at) : ""}
            {preview && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {formatUploadTime(preview.created_at)}
              </span>
            )}
          </DialogTitle>
          {preview && (
            <>
              <img
                src={preview.file_url}
                alt={preview.label}
                className="mt-3 max-h-[70vh] w-full bg-muted object-contain"
              />
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="truncate text-sm text-muted-foreground">{preview.file_name}</span>
                <Button variant="outline" size="sm" onClick={() => downloadPhoto(preview)}>
                  <Download className="mr-1.5 size-4" />
                  Télécharger
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        vehicleId={vehicleId}
        organizationId={organizationId}
        documentType="photo"
      />

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette photo</AlertDialogTitle>
            <AlertDialogDescription>
              La photo du {toDelete ? formatUploadDate(toDelete.created_at) : ""} sera
              définitivement supprimée.
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
