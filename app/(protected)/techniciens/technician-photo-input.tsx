"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, User, X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface TechnicianPhotoInputProps {
  /** Photo deja enregistree, ou null */
  existingUrl?: string | null;
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}

const MAX_SIZE = 2 * 1024 * 1024; // 2 Mo

/**
 * Choix de la photo d'un technicien.
 *
 * Le formulaire de creation n'en proposait aucune — seule la modification le
 * permettait, d'ou 1 technicien sur 30 avec une photo alors que l'avatar est
 * affiche dans la liste, l'outillage et les vehicules.
 */
export default function TechnicianPhotoInput({
  existingUrl,
  file,
  onFileChange,
  disabled,
}: TechnicianPhotoInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Derive au rendu : un setState dans un effet ferait clignoter l'apercu
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const shown = previewUrl ?? existingUrl ?? null;

  const handlePick = (picked: File | undefined) => {
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      setError("Choisissez un fichier image.");
      return;
    }
    if (picked.size > MAX_SIZE) {
      setError("Image trop lourde (2 Mo maximum).");
      return;
    }
    setError(null);
    onFileChange(picked);
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
          {shown ? (
            // next/image refuse les URL blob: des apercus locaux
            <img src={shown} alt="" className="size-full object-cover" />
          ) : (
            <User className="size-5 text-muted-foreground" />
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="mr-2 size-3.5" />
            {shown ? "Remplacer" : "Photo"}
          </Button>
          {file && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => {
                setError(null);
                onFileChange(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              <X className="mr-1 size-3.5" />
              Retirer
            </Button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handlePick(e.target.files?.[0])}
        />
      </div>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
