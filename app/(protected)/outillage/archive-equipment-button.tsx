"use client";

import { useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { useQueryClient } from "@tanstack/react-query";

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
} from "@/components/ui/alert-dialog";
import { archiveProduct, unarchiveProduct } from "@/lib/supabase/queries/products";
import { createExit } from "@/lib/supabase/queries/stock-movements";
import { queryKeys } from "@/lib/query-keys";

interface ArchiveEquipmentButtonProps {
  productId: string;
  productName: string;
  /** Nombre d'exemplaires encore chez des techniciens */
  assignedCount: number;
  /** Unites encore en stock — archiver malgre elles merite un avertissement */
  stockCount: number;
  /**
   * Ce que detient chaque societe.
   *
   * Archiver sort les unites restantes du stock : il faut savoir chez qui les
   * prendre, une sortie ne concernant qu'une societe a la fois.
   */
  orgStock: { organization_id: string; stock_current: number }[];
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
  orgStock,
  isArchived,
  onArchived,
}: ArchiveEquipmentButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  // Le motif est exige : « archive » sans raison ne dit rien six mois plus tard,
  // et c'est justement a ce moment-la qu'on relit la fiche.
  const canArchive = reason.trim().length > 0;

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

  // Les societes qui detiennent encore des unites au moment de l'archivage.
  const holdings = orgStock.filter((o) => o.stock_current > 0);
  // Un stock que la ventilation ne couvre pas : anciennes fiches, creees avant
  // que l'outillage n'ait des lignes par societe. On ne saurait pas ou puiser.
  const unaccounted = stockCount - holdings.reduce((s, o) => s + o.stock_current, 0);

  const handleArchive = async () => {
    if (!canArchive) return;
    setIsPending(true);
    try {
      // Le stock sort d'abord, la fiche est archivee ensuite.
      //
      // Un outil casse ou vole n'est plus la : le laisser compte apres
      // l'archivage faisait mentir tous les totaux — la fiche quittait le
      // catalogue pendant que ses unites continuaient de peser. La sortie est
      // un vrai mouvement, avec le motif de l'archivage : le journal garde donc
      // la trace de ce qui a disparu, et pourquoi.
      //
      // Une sortie par societe : chacune ne peut puiser que dans son propre
      // stock. L'ordre compte — si une sortie echoue, la fiche reste au
      // catalogue avec son stock, etat coherent qu'on peut reprendre.
      for (const holding of holdings) {
        await createExit(
          holding.organization_id,
          productId,
          holding.stock_current,
          "exit_anonymous",
          undefined,
          reason
        );
      }

      await archiveProduct(productId, { reason });
      queryClient.invalidateQueries({ queryKey: queryKeys.equipment.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.movements.all });

      const removed = holdings.reduce((s, o) => s + o.stock_current, 0);
      toast.success(
        removed > 0
          ? `${productName} archivé · ${removed} unité${removed > 1 ? "s" : ""} sortie${removed > 1 ? "s" : ""} du stock`
          : `${productName} archivé`
      );
      setOpen(false);
      setReason("");
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

      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setReason("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiver {productName} ?</AlertDialogTitle>
            {/* Dire ce qui va se passer, pas ce qui est conservé. Le stock
                sortait autrefois indemne de l'archivage : la fiche quittait le
                catalogue et ses unités continuaient de compter. */}
            <AlertDialogDescription>
              {stockCount > 0 ? (
                <>
                  Les{" "}
                  <span className="font-semibold text-foreground">
                    {stockCount} unité{stockCount > 1 ? "s" : ""} restante
                    {stockCount > 1 ? "s" : ""} sortiront du stock
                  </span>{" "}
                  avec ce motif, et l&apos;outil quittera le catalogue. La sortie apparaîtra dans
                  les mouvements ; les achats et l&apos;historique sont conservés.
                </>
              ) : (
                <>
                  L&apos;outil quitte le catalogue. Ses achats et son historique d&apos;assignations
                  sont conservés.
                </>
              )}{" "}
              Il reste restaurable depuis le filtre « Archivés ».
              {unaccounted > 0 && (
                <span className="mt-2 block font-medium text-attention">
                  {unaccounted} unité{unaccounted > 1 ? "s" : ""} ne{" "}
                  {unaccounted > 1 ? "sont" : "est"} rattachée{unaccounted > 1 ? "s" : ""} à aucune
                  société et restera
                  {unaccounted > 1 ? "ont" : ""} comptée{unaccounted > 1 ? "s" : ""} : fiche
                  antérieure à la ventilation par société.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="archive-reason">Motif de l&apos;archivage</Label>
            <Textarea
              id="archive-reason"
              autoFocus
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isPending}
              placeholder="Cassé sur chantier, perdu, volé, remplacé par un modèle plus récent…"
            />
            <p className="text-xs text-muted-foreground">
              Obligatoire. C&apos;est ce qui expliquera la sortie du catalogue quand on relira la
              fiche dans six mois.
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Retour</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={isPending || !canArchive}>
              {isPending ? "Archivage…" : "Archiver"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
