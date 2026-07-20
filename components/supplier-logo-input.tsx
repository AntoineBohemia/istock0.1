"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Truck, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface SupplierLogoInputProps {
  /** Logo deja enregistre (URL publique), ou null */
  existingUrl: string | null;
  /** Fichier choisi mais pas encore televerse */
  file: File | null;
  onFileChange: (file: File | null) => void;
  /** Retire le logo existant comme le fichier en attente */
  onRemove: () => void;
  disabled?: boolean;
}

const MAX_SIZE = 2 * 1024 * 1024; // 2 Mo

/**
 * Choix du logo d'un fournisseur.
 *
 * Composant partage entre la creation et la modification : dupliquer le bloc
 * de champ entre les deux formulaires est ce qui a fait disparaitre le lien
 * produit et la description de l'outillage des ecrans d'edition.
 */
export default function SupplierLogoInput({
  existingUrl,
  file,
  onFileChange,
  onRemove,
  disabled,
}: SupplierLogoInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Derive au rendu plutot que pose dans un effet : un setState dans un effet
  // provoque un second rendu inutile et l'apercu clignote.
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  // L'URL blob doit etre liberee, sinon chaque choix de fichier fuit en memoire
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const shown = previewUrl ?? existingUrl;

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
    <div className="grid gap-2">
      <Label>Logo</Label>
      <div className="flex items-center gap-3">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {shown ? (
            // next/image refuse les URL blob: des apercus locaux
            <img src={shown} alt="" className="size-full object-contain" />
          ) : (
            <Truck className="size-5 text-muted-foreground" />
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
            {shown ? "Remplacer" : "Choisir"}
          </Button>
          {shown && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => {
                setError(null);
                onRemove();
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
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
