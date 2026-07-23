"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Camera, Check, Loader2, X } from "lucide-react";

import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateVehicleInspection } from "@/hooks/queries";
import { uploadInspectionPhoto } from "@/lib/supabase/queries/vehicle-inspections";
import {
  INSPECTION_ITEMS,
  RATING_ORDER,
  RATING_LABELS,
  type InspectionItem,
  type InspectionRating,
} from "@/lib/supabase/queries/vehicle-inspections";
import type { VehicleWithTechnician } from "@/lib/supabase/queries/vehicles";
import { MobileStackScreen, InsetGroup, InsetField } from "./mobile-stack-screen";

// Du meilleur au pire : le degrade porte le sens, on n'a pas a lire pour
// comprendre. Vert franc pour « neuf », rouge pour « mauvais ».
const RATING_STYLE: Record<InspectionRating, string> = {
  neuf: "bg-emerald-500 text-white",
  bon: "bg-green-500 text-white",
  correct: "bg-amber-500 text-white",
  mauvais: "bg-red-500 text-white",
};

type Draft = Record<string, { rating: InspectionRating | null; comment: string }>;

export function MobileVehicleInspection({
  vehicle,
  open,
  onClose,
}: {
  vehicle: VehicleWithTechnician | null;
  open: boolean;
  onClose: () => void;
}) {
  const createInspection = useCreateVehicleInspection();

  const detenteur = vehicle?.technician
    ? `${vehicle.technician.first_name} ${vehicle.technician.last_name}`
    : "";

  const [driverName, setDriverName] = useState(detenteur);
  const [mileage, setMileage] = useState(vehicle?.mileage != null ? String(vehicle.mileage) : "");
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState<Draft>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reinitialise a chaque vehicule : on ouvre une feuille vierge, pas les
  // reponses du controle precedent. Pattern React « ajuster un etat quand une
  // prop change » — la garde par etat evite la boucle.
  const vehicleId = vehicle?.id;
  const [lastVehicleId, setLastVehicleId] = useState<string | null>(null);
  if (vehicleId && vehicleId !== lastVehicleId) {
    setLastVehicleId(vehicleId);
    setDriverName(detenteur);
    setMileage(vehicle?.mileage != null ? String(vehicle.mileage) : "");
    setNote("");
    setDraft({});
    setPhotos([]);
  }

  const ratedCount = useMemo(
    () => INSPECTION_ITEMS.filter((it) => draft[it.key]?.rating).length,
    [draft]
  );
  const allRated = ratedCount === INSPECTION_ITEMS.length;

  const setRating = (key: string, rating: InspectionRating) => {
    navigator.vibrate?.(8);
    setDraft((prev) => ({
      ...prev,
      [key]: { rating, comment: prev[key]?.comment ?? "" },
    }));
  };

  const setComment = (key: string, comment: string) => {
    setDraft((prev) => ({
      ...prev,
      [key]: { rating: prev[key]?.rating ?? null, comment },
    }));
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !vehicleId) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        urls.push(await uploadInspectionPhoto(file, vehicleId));
      }
      setPhotos((prev) => [...prev, ...urls]);
      navigator.vibrate?.(8);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'envoi de la photo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSubmit = () => {
    if (!vehicleId || !allRated || createInspection.isPending) return;

    const items: InspectionItem[] = INSPECTION_ITEMS.map((it) => ({
      key: it.key,
      label: it.label,
      rating: draft[it.key]?.rating ?? null,
      comment: (draft[it.key]?.comment ?? "").trim(),
    }));

    const parsedMileage = mileage.trim() ? parseInt(mileage, 10) : null;

    createInspection.mutate(
      {
        vehicleId,
        driverName: driverName.trim() || null,
        mileage: Number.isFinite(parsedMileage as number) ? parsedMileage : null,
        items,
        photoUrls: photos,
        note: note.trim() || null,
      },
      {
        onSuccess: () => {
          navigator.vibrate?.(12);
          toast.success("État des lieux enregistré");
          onClose();
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
        },
      }
    );
  };

  const footer = (
    <Button
      className="h-12 w-full text-base active:scale-[0.97]"
      onClick={handleSubmit}
      disabled={!allRated || createInspection.isPending || uploading}
    >
      {createInspection.isPending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Enregistrement&hellip;
        </>
      ) : allRated ? (
        "Valider l'état des lieux"
      ) : (
        `Encore ${INSPECTION_ITEMS.length - ratedCount} point${
          INSPECTION_ITEMS.length - ratedCount > 1 ? "s" : ""
        }`
      )}
    </Button>
  );

  return (
    <MobileStackScreen
      open={open}
      title={vehicle?.name ?? "État des lieux"}
      subtitle={vehicle?.license_plate}
      onClose={onClose}
      footer={footer}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3">
        {/* Progression — on voit d'un coup ce qu'il reste a faire. */}
        <div className="mb-4">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="font-heading text-lg font-semibold">État des lieux</span>
            <span className="text-sm tabular-nums text-muted-foreground">
              {ratedCount}/{INSPECTION_ITEMS.length} vérifiés
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={false}
              animate={{ width: `${(ratedCount / INSPECTION_ITEMS.length) * 100}%` }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            />
          </div>
        </div>

        {/* Contexte : qui conduit, combien de km. Le conducteur n'est pas
            modifiable ici — il vaut le detenteur du vehicule ; sa correction se
            fait sur l'ordinateur. Le kilometrage, lui, se releve sur place. */}
        <InsetGroup header="Contexte">
          <InsetField label="Conducteur">
            <span className={cn("text-base", !driverName && "text-muted-foreground")}>
              {driverName || "Aucun détenteur"}
            </span>
          </InsetField>
          <InsetField label="Kilométrage">
            <div className="flex items-center justify-end gap-1">
              <Input
                type="number"
                inputMode="numeric"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                placeholder="0"
                className="h-auto w-24 border-0 bg-transparent p-0 text-right text-base tabular-nums shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-base text-muted-foreground">km</span>
            </div>
          </InsetField>
        </InsetGroup>

        {/* La grille. Un point = un intitule + quatre notes. La note choisie se
            remplit de sa couleur ; un commentaire se glisse dessous. */}
        <div className="mt-5 space-y-2.5">
          {INSPECTION_ITEMS.map((it) => {
            const current = draft[it.key];
            return (
              <div key={it.key} className="rounded-2xl border bg-white p-3 dark:bg-card">
                <p className="mb-2.5 text-base font-medium">{it.label}</p>
                <div className="flex gap-1.5">
                  {RATING_ORDER.map((r) => {
                    const active = current?.rating === r;
                    return (
                      <button
                        key={r}
                        onClick={() => setRating(it.key, r)}
                        className={cn(
                          "relative flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors active:scale-95",
                          active ? RATING_STYLE[r] : "bg-muted/60 text-muted-foreground"
                        )}
                      >
                        {RATING_LABELS[r]}
                        {active && (
                          <motion.span
                            layoutId={`check-${it.key}`}
                            className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-white shadow"
                          >
                            <Check className="size-3 text-emerald-600" />
                          </motion.span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {current?.rating && (
                  <Input
                    value={current.comment}
                    onChange={(e) => setComment(it.key, e.target.value)}
                    placeholder="Commentaire (facultatif)"
                    className="mt-2 h-10 rounded-xl border-0 bg-muted/50 text-sm"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Photos — galerie generale du controle. */}
        <div className="mt-5">
          <p className="mb-2 px-1 text-sm uppercase tracking-wide text-muted-foreground">Photos</p>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((url) => (
              <div key={url} className="relative aspect-square">
                <img src={url} alt="" className="size-full rounded-xl object-cover" />
                <button
                  onClick={() => setPhotos((prev) => prev.filter((p) => p !== url))}
                  className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white active:scale-90"
                  aria-label="Retirer la photo"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-muted/30 text-muted-foreground active:scale-95 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <>
                  <Camera className="size-6" />
                  <span className="text-xs font-medium">Ajouter</span>
                </>
              )}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {/* Observation generale. */}
        <div className="mt-5">
          <p className="mb-2 px-1 text-sm uppercase tracking-wide text-muted-foreground">
            Observation
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Remarque générale sur le véhicule…"
            rows={3}
            className="w-full rounded-2xl border bg-white p-3 text-base shadow-none outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-card"
          />
        </div>
      </div>
    </MobileStackScreen>
  );
}
