"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ArchiveButtonProps {
  /** Label affiché dans le titre de la modal (ex: "le produit", "le technicien") */
  entityLabel: string;
  /** Nom de l'entité à archiver (affiché en gras dans la description) */
  entityName: string;
  /** Fonction d'archivage à appeler */
  onArchive: () => Promise<void>;
  /** Chemin de redirection après archivage */
  redirectTo: string;
}

export default function ArchiveButton({
  entityLabel,
  entityName,
  onArchive,
  redirectTo,
}: ArchiveButtonProps) {
  const router = useRouter();
  const [isArchiving, setIsArchiving] = useState(false);
  const [open, setOpen] = useState(false);

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      await onArchive();
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
    <AlertDialog open={open} onOpenChange={setOpen}>
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
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isArchiving}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleArchive}
            disabled={isArchiving}
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
