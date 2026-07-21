"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Undo2 } from "lucide-react";
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
import { reverseStockMovement } from "@/lib/supabase/queries/stock-movements";
import { queryKeys } from "@/lib/query-keys";

interface ReverseMovementButtonProps {
  movementId: string;
  /** « entrée » ou « sortie », pour formuler la confirmation */
  kind: "entrée" | "sortie";
  productName: string;
  quantity: number;
  /** Quantite deja corrigee par des corrections precedentes */
  alreadyReversed?: number;
  /** Ce mouvement est-il deja annule, ou est-il lui-meme une correction ? */
  disabledReason?: string | null;
}

/**
 * Annulation d'un mouvement par mouvement inverse.
 *
 * On n'efface ni ne modifie la ligne d'origine : un mouvement de correction
 * s'ajoute. L'erreur reste visible a cote de sa correction, ce qui permet
 * d'expliquer un ecart de stock constate plus tard.
 */
export default function ReverseMovementButton({
  movementId,
  kind,
  productName,
  quantity,
  alreadyReversed = 0,
  disabledReason,
}: ReverseMovementButtonProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  // Solde encore corrigeable : la quantite d'origine moins ce qui l'a deja ete
  const remaining = quantity - alreadyReversed;
  const [qty, setQty] = useState(remaining);

  const handleReverse = async () => {
    setIsPending(true);
    try {
      await reverseStockMovement(movementId, qty);
      // Le stock a bouge : produits, mouvements et tableaux de bord sont
      // tous concernes.
      queryClient.invalidateQueries({ queryKey: queryKeys.movements.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.technicians.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      toast.success(
        `${qty} unité${qty > 1 ? "s" : ""} corrigée${qty > 1 ? "s" : ""}, stock rétabli`
      );
      setOpen(false);
      router.refresh();
    } catch (err) {
      // Les refus de la fonction en base sont explicites (stock deja
      // consomme, technicien ne detenant plus les unites) : on les relaie.
      toast.error(err instanceof Error ? err.message : "Erreur lors de la correction");
    } finally {
      setIsPending(false);
    }
  };

  if (disabledReason) {
    // La raison est affichee a cote, pas seulement en infobulle : un bouton
    // grise sans explication laisse chercher pourquoi.
    return (
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground text-right max-w-[220px]">
          {disabledReason}
        </span>
        <Button variant="outline" size="sm" disabled className="bg-white dark:bg-card">
          <Undo2 className="mr-2 size-3.5" />
          Corriger
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="bg-white dark:bg-card text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Undo2 className="mr-2 size-3.5" />
        Corriger
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Corriger cette {kind} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Un mouvement de correction sera créé et le stock rétabli d&apos;autant. La ligne
              d&apos;origine reste dans l&apos;historique, à côté de sa correction.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Quantite ajustable : l'erreur porte souvent sur le chiffre lui-meme
              (40 saisi au lieu de 4). Corriger 36 evite d'annuler puis ressaisir. */}
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{productName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {alreadyReversed > 0
                  ? `${alreadyReversed} déjà corrigée${alreadyReversed > 1 ? "s" : ""} sur ${quantity} · ${remaining} restante${remaining > 1 ? "s" : ""}`
                  : `Mouvement de ${quantity} unité${quantity > 1 ? "s" : ""}`}
              </p>
            </div>
            <div className="flex items-center rounded-md border bg-background h-9 shrink-0">
              <button
                type="button"
                disabled={qty <= 1 || isPending}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="px-2.5 h-full text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                aria-label="Diminuer la quantité à corriger"
              >
                <Minus className="size-3.5" />
              </button>
              <span className="w-10 text-center text-sm font-semibold tabular-nums">{qty}</span>
              <button
                type="button"
                disabled={qty >= remaining || isPending}
                onClick={() => setQty((q) => Math.min(remaining, q + 1))}
                className="px-2.5 h-full text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                aria-label="Augmenter la quantité à corriger"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Retour</AlertDialogCancel>
            <AlertDialogAction onClick={handleReverse} disabled={isPending}>
              {isPending ? "Correction…" : `Corriger ${qty} unité${qty > 1 ? "s" : ""}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
