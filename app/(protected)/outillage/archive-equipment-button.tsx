"use client";

import { useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { useQueryClient } from "@tanstack/react-query";

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
import { archiveProduct, unarchiveProduct } from "@/lib/supabase/queries/products";
import { queryKeys } from "@/lib/query-keys";

interface ArchiveEquipmentButtonProps {
  productId: string;
  productName: string;
  /** Nombre d'exemplaires encore chez des techniciens */
  assignedCount: number;
  /** Unites encore en stock — archiver malgre elles merite un avertissement */
  stockCount: number;
  /** L'outil est-il deja archive ? Le bouton devient alors « Restaurer ». */
  isArchived: boolean;
  onArchived: () => void;
}

/**
 * Archivage d'un outil.
 *
 * archiveProduct existait cote donnees sans etre branche : aucun ecran ne
 * permettait de retirer un outil du catalogue.
 */
export default function ArchiveEquipmentButton({
  productId,
  productName,
  assignedCount,
  stockCount,
  isArchived,
  onArchived,
}: ArchiveEquipmentButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const queryClient = useQueryClient();

  // Un outil encore prete ne doit pas disparaitre du catalogue : le
  // technicien le detient toujours, et son inventaire deviendrait faux.
  const blocked = assignedCount > 0;

  const handleRestore = async () => {
    setIsPending(true);
    try {
      await unarchiveProduct(productId);
      queryClient.invalidateQueries({ queryKey: queryKeys.equipment.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      toast.success(`${productName} restauré`);
      onArchived();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la restauration");
    } finally {
      setIsPending(false);
    }
  };

  // Outil archive : le seul geste utile est de le remettre au catalogue.
  if (isArchived) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs shrink-0"
        onClick={handleRestore}
        disabled={isPending}
      >
        <RotateCcw className="mr-1.5 size-3.5" />
        {isPending ? "Restauration…" : "Restaurer"}
      </Button>
    );
  }

  const handleArchive = async () => {
    setIsPending(true);
    try {
      await archiveProduct(productId);
      queryClient.invalidateQueries({ queryKey: queryKeys.equipment.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      toast.success(`${productName} archivé`);
      setOpen(false);
      onArchived();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'archivage");
    } finally {
      setIsPending(false);
    }
  };

  if (blocked) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className="h-8 text-xs shrink-0"
        title={`Encore ${assignedCount} exemplaire${assignedCount > 1 ? "s" : ""} chez un technicien`}
      >
        <Trash2 className="size-3.5" />
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
        title="Archiver cet outil"
      >
        <Trash2 className="size-3.5" />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiver {productName} ?</AlertDialogTitle>
            <AlertDialogDescription>
              L&apos;outil disparaît du catalogue mais son historique d&apos;achats et
              d&apos;assignations est conservé. Il reste restaurable depuis le filtre « Archivés ».
              {stockCount > 0 && (
                <>
                  {" "}
                  <span className="font-semibold text-foreground">
                    Attention : il reste {stockCount} unité{stockCount > 1 ? "s" : ""} en stock.
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Retour</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={isPending}>
              {isPending ? "Archivage…" : "Archiver"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
