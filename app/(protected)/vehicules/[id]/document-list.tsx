"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Image, Loader2, Trash2, Upload } from "lucide-react";

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
import { toast } from "@/lib/toast";

import { useVehicleDocuments } from "@/hooks/queries/use-vehicles";
import { useDeleteVehicleDocument } from "@/hooks/mutations/use-vehicle-mutations";
import type { VehicleDocument, DocumentType } from "@/lib/supabase/queries/vehicles";
import UploadDocumentDialog from "./upload-document-dialog";

interface DocumentListProps {
  vehicleId: string;
  organizationId: string;
  documentType: DocumentType;
}

const TYPE_LABELS: Record<DocumentType, { empty: string; description: string }> = {
  contract: {
    empty: "Aucun contrat",
    description: "Ajoutez vos contrats de location, leasing ou achat.",
  },
  revision: {
    empty: "Aucune facture entretien",
    description: "Ajoutez vos factures d'entretien et contrôles techniques.",
  },
  insurance: {
    empty: "Aucune assurance",
    description: "Ajoutez vos attestations et contrats d'assurance.",
  },
  photo: {
    empty: "Aucune photo",
    description: "Gardez une trace datée de l'état du véhicule dans le temps.",
  },
};

function getMimeIcon(mimeType: string | null) {
  if (!mimeType) return FileText;
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return FileSpreadsheet;
  return FileText;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isWithin30Days(dateStr: string): boolean {
  const diff = new Date(dateStr).getTime() - Date.now();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
}

function isExpired(dateStr: string): boolean {
  return new Date(dateStr).getTime() < Date.now();
}

export default function DocumentList({
  vehicleId,
  organizationId,
  documentType,
}: DocumentListProps) {
  const { data: documents = [], isLoading } = useVehicleDocuments(vehicleId, documentType);
  const deleteMutation = useDeleteVehicleDocument();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<VehicleDocument | null>(null);

  const handleDelete = () => {
    if (!docToDelete) return;
    deleteMutation.mutate(
      {
        id: docToDelete.id,
        fileUrl: docToDelete.file_url,
        vehicleId,
        documentType,
      },
      {
        onSuccess: () => {
          toast.success("Document supprimé");
          setDocToDelete(null);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Erreur");
        },
      }
    );
  };

  const labels = TYPE_LABELS[documentType];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <div className="size-10 rounded-lg bg-muted animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-40 rounded bg-muted animate-pulse" />
              <div className="h-3 w-56 rounded bg-muted animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {documents.length} document{documents.length > 1 ? "s" : ""}
        </p>
        <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="size-4 mr-1.5" />
          Ajouter
        </Button>
      </div>

      {/* Empty state */}
      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted mb-3">
            <FileText className="size-5 text-muted-foreground" />
          </div>
          <h3 className="font-heading font-semibold text-sm">{labels.empty}</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">{labels.description}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setUploadOpen(true)}>
            <Upload className="size-4 mr-1.5" />
            Ajouter un document
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const Icon = getMimeIcon(doc.mime_type);
            const expiring = doc.valid_until ? isWithin30Days(doc.valid_until) : false;
            const expired = doc.valid_until ? isExpired(doc.valid_until) : false;

            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-xl border bg-card p-3 group transition-colors hover:bg-muted/30"
              >
                {/* Icon */}
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted shrink-0">
                  <Icon className="size-5 text-muted-foreground" />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{doc.label}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {doc.file_name}
                    {doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ""}
                    {doc.valid_from && ` · Du ${formatDate(doc.valid_from)}`}
                    {doc.valid_until && (
                      <span
                        className={
                          expired
                            ? "text-destructive font-medium"
                            : expiring
                              ? "text-orange-500 font-medium"
                              : ""
                        }
                      >
                        {" "}
                        · {expired ? "Expiré le" : "Expire le"} {formatDate(doc.valid_until)}
                      </span>
                    )}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button variant="ghost" size="icon" className="size-8" asChild>
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" download>
                      <Download className="size-4" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => setDocToDelete(doc)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        vehicleId={vehicleId}
        organizationId={organizationId}
        documentType={documentType}
      />

      <AlertDialog open={!!docToDelete} onOpenChange={(o) => !o && setDocToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce document</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer &quot;{docToDelete?.label}&quot; ? Le fichier sera
              définitivement supprimé.
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
