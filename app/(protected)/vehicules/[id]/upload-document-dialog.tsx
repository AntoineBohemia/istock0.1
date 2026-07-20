"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";

import { useUploadVehicleDocument } from "@/hooks/mutations/use-vehicle-mutations";
import type { DocumentType } from "@/lib/supabase/queries/vehicles";

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  organizationId: string;
  documentType: DocumentType;
}

const TYPE_TITLES: Record<DocumentType, string> = {
  contract: "Ajouter un contrat",
  revision: "Ajouter une révision",
  insurance: "Ajouter une assurance",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function UploadDocumentDialog({
  open,
  onOpenChange,
  vehicleId,
  organizationId,
  documentType,
}: UploadDocumentDialogProps) {
  const uploadMutation = useUploadVehicleDocument();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prevOpen, setPrevOpen] = useState(open);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  if (open && !prevOpen) {
    setFile(null);
    setLabel("");
    setValidFrom("");
    setValidUntil("");
  }
  if (open !== prevOpen) setPrevOpen(open);

  const handleFileSelect = (selected: File | null) => {
    if (!selected) return;
    setFile(selected);
    if (!label.trim()) {
      const nameWithoutExt = selected.name.replace(/\.[^.]+$/, "");
      setLabel(nameWithoutExt);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !label.trim()) return;

    uploadMutation.mutate(
      {
        file,
        vehicleId,
        organizationId,
        documentType,
        metadata: {
          label: label.trim(),
          validFrom: validFrom || undefined,
          validUntil: validUntil || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("Document ajouté");
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Erreur lors de l'upload");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 p-0 flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-semibold">{TYPE_TITLES[documentType]}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="px-5 py-3 border-t space-y-3">
            {/* File drop zone */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Fichier *
              </label>
              {file ? (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2.5">
                  <FileUp className="size-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="size-6 flex items-center justify-center rounded-full hover:bg-muted transition-colors shrink-0"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  data-dragging={isDragging || undefined}
                  className="flex flex-col items-center justify-center h-24 rounded-lg border border-dashed data-[dragging=true]:bg-accent/50 transition-colors cursor-pointer"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="sr-only"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                  />
                  <FileUp className="size-5 text-muted-foreground/60 mb-1.5" />
                  <p className="text-xs text-muted-foreground">
                    PDF, image, Word ou Excel (max. 10 Mo)
                  </p>
                </div>
              )}
            </div>

            {/* Label */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Nom du document *
              </label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex: Contrat Lease 2026"
                required
                className="bg-white dark:bg-card"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Début validité
                </label>
                <Input
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  className="bg-white dark:bg-card"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Fin validité
                </label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="bg-white dark:bg-card"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-5 py-4 border-t">
            <div className="flex-1" />
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={uploadMutation.isPending}
              className="h-10 bg-white dark:bg-card"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={uploadMutation.isPending || !file || !label.trim()}
              className="h-10"
            >
              {uploadMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
