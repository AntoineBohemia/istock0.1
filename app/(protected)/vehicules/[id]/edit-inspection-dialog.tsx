"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateVehicleInspection } from "@/hooks/queries";
import {
  RATING_ORDER,
  RATING_LABELS,
  RATING_COLORS,
  uploadInspectionPhoto,
  type InspectionItem,
  type InspectionRating,
  type VehicleInspection,
} from "@/lib/supabase/queries/vehicle-inspections";

export default function EditInspectionDialog({
  inspection,
  vehicleId,
  open,
  onOpenChange,
}: {
  inspection: VehicleInspection;
  vehicleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateVehicleInspection();

  const [driverName, setDriverName] = useState(inspection.driver_name ?? "");
  const [mileage, setMileage] = useState(
    inspection.mileage != null ? String(inspection.mileage) : ""
  );
  const [note, setNote] = useState(inspection.note ?? "");
  const [items, setItems] = useState<InspectionItem[]>(() =>
    inspection.items.map((i) => ({ ...i }))
  );
  const [photos, setPhotos] = useState<string[]>(inspection.photo_urls);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const setRating = (key: string, rating: InspectionRating) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, rating } : i)));
  const setComment = (key: string, comment: string) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, comment } : i)));

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        urls.push(await uploadInspectionPhoto(file, vehicleId));
      }
      setPhotos((prev) => [...prev, ...urls]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'envoi de la photo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = () => {
    const parsed = mileage.trim() ? parseInt(mileage, 10) : null;
    update.mutate(
      {
        id: inspection.id,
        vehicleId,
        driverName: driverName.trim() || null,
        mileage: Number.isFinite(parsed as number) ? parsed : null,
        items: items.map((i) => ({ ...i, comment: i.comment.trim() })),
        photoUrls: photos,
        note: note.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("État des lieux mis à jour");
          onOpenChange(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Modifier l&apos;état des lieux</DialogTitle>
          <DialogDescription>
            Corrigez les notes, le kilométrage, les photos ou l&apos;observation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Contexte */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-driver">Conducteur</Label>
              <Input
                id="edit-driver"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Nom du conducteur"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-mileage">Kilométrage</Label>
              <Input
                id="edit-mileage"
                type="number"
                inputMode="numeric"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Points */}
          <div className="space-y-2.5">
            {items.map((item) => (
              <div key={item.key} className="rounded-xl border p-3">
                <p className="mb-2 text-sm font-medium">{item.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {RATING_ORDER.map((r) => {
                    const active = item.rating === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRating(item.key, r)}
                        aria-pressed={active}
                        aria-label={`${item.label} : ${RATING_LABELS[r]}`}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
                          active
                            ? RATING_COLORS[r].solid
                            : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {RATING_LABELS[r]}
                      </button>
                    );
                  })}
                </div>
                <Input
                  value={item.comment}
                  onChange={(e) => setComment(item.key, e.target.value)}
                  placeholder="Commentaire (facultatif)"
                  className="mt-2 h-9"
                />
              </div>
            ))}
          </div>

          {/* Photos */}
          <div>
            <Label className="mb-2 block">Photos</Label>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {photos.map((url) => (
                <div key={url} className="relative aspect-square">
                  <img src={url} alt="" className="size-full rounded-lg border object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((p) => p !== url))}
                    className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    aria-label="Retirer la photo"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-muted-foreground hover:bg-muted/40 disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <>
                    <Camera className="size-5" />
                    <span className="text-xs">Ajouter</span>
                  </>
                )}
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {/* Observation */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-note">Observation</Label>
            <textarea
              id="edit-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Remarque générale…"
              className="w-full rounded-lg border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={update.isPending}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={update.isPending || uploading}>
            {update.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
