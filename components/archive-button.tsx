"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ArchiveButtonProps {
  /** Label affiché dans le titre de la modal (ex: "le produit", "le technicien") */
  entityLabel: string;
  /** Nom de l'entité à archiver (affiché en gras dans la description) */
  entityName: string;
  /** Fonction d'archivage à appeler. Reçoit le motif quand il est demandé. */
  onArchive: (reason?: string) => Promise<void>;
  /** Chemin de redirection après archivage */
  redirectTo: string;
  /**
   * Exiger un motif écrit.
   *
   * « Archivé » sans raison ne dit rien six mois plus tard — et c'est
   * précisément à ce moment-là qu'on rouvre la fiche pour comprendre pourquoi
   * elle a quitté le catalogue. L'outillage le demandait déjà ; le rendre
   * disponible ici évite d'écrire une seconde modale d'archivage.
   */
  requireReason?: boolean;
  /** Exemples de motifs, affichés en gris dans le champ */
  reasonPlaceholder?: string;
  /** Avertissement affiché avant de valider (stock restant, prêts en cours…) */
  warning?: React.ReactNode;
}

export default function ArchiveButton({
  entityLabel,
  entityName,
  onArchive,
  redirectTo,
  requireReason = false,
  reasonPlaceholder,
  warning,
}: ArchiveButtonProps) {
  const router = useRouter();
  const [isArchiving, setIsArchiving] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const canArchive = !requireReason || reason.trim().length > 0;

  const handleArchive = async () => {
    if (!canArchive) return;
    setIsArchiving(true);
    try {
      await onArchive(reason.trim() || undefined);
      toast.success(`${entityName} archivé avec succès`);
      router.push(redirectTo);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'archivage");
    } finally {
      setIsArchiving(false);
      setOpen(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setReason("");
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="text-destructive hover:text-destructive">
          Archiver
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archiver {entityLabel} ?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{entityName}</strong> sera archivé et ne sera plus visible dans les listes et
            statistiques.
            {warning && <span className="block mt-2 font-semibold text-foreground">{warning}</span>}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {requireReason && (
          <div className="space-y-2">
            <Label htmlFor="archive-reason">Motif de l&apos;archivage</Label>
            <Textarea
              id="archive-reason"
              autoFocus
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isArchiving}
              placeholder={reasonPlaceholder}
            />
            <p className="text-xs text-muted-foreground">
              Obligatoire. C&apos;est ce qui expliquera la sortie du catalogue quand on relira la
              fiche.
            </p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isArchiving}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleArchive}
            disabled={isArchiving || !canArchive}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isArchiving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Archiver
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
