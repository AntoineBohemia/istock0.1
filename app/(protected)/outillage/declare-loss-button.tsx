"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Plus, PackageMinus } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { archiveProduct } from "@/lib/supabase/queries/products";
import { createExit } from "@/lib/supabase/queries/stock-movements";
import { queryKeys } from "@/lib/query-keys";

interface DeclareLossButtonProps {
  productId: string;
  productName: string;
  /** Stock global disponible (prêts non compris). */
  availableStock: number;
  onDone: () => void;
}

/**
 * Déclarer une perte : cassé, perdu, volé.
 *
 * L'outillage se suit globalement, sans ventilation par société : la perte est
 * une seule sortie, imputée à la société courante, plafonnée au stock global
 * disponible. (Auparavant on répartissait la perte sur des lignes par société
 * qui n'ont pas de sens pour l'outillage — ce qui pouvait rendre le stock
 * incohérent.)
 *
 * Il n'y a qu'une action, qui pose les questions qu'on se pose déjà : combien,
 * et pourquoi. La sortie du catalogue devient une conséquence qu'on accepte —
 * une case à cocher, proposée au seul moment où elle a un sens : quand il ne
 * reste plus rien.
 */
export default function DeclareLossButton({
  productId,
  productName,
  availableStock,
  onDone,
}: DeclareLossButtonProps) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [alsoArchive, setAlsoArchive] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const queryClient = useQueryClient();
  const currentOrgId = useOrganizationStore((s) => s.currentOrganization?.id);

  const losingEverything = quantity >= availableStock && availableStock > 0;
  const canSubmit =
    reason.trim().length > 0 &&
    quantity >= 1 &&
    quantity <= availableStock &&
    !!currentOrgId &&
    !isPending;

  const reset = () => {
    setQuantity(1);
    setReason("");
    setAlsoArchive(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit || !currentOrgId) return;
    setIsPending(true);
    try {
      // La sortie d'abord, l'archivage ensuite : si la sortie échoue, la fiche
      // reste au catalogue avec son stock — un état cohérent, qu'on peut
      // reprendre. L'inverse laisserait une fiche archivée au stock intact.
      await createExit(currentOrgId, productId, quantity, "exit_anonymous", undefined, reason);
      if (alsoArchive && losingEverything) {
        await archiveProduct(productId, { reason });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.equipment.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.movements.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
      ]);

      toast.success(
        alsoArchive && losingEverything
          ? `${productName} — ${quantity} perdu${quantity > 1 ? "s" : ""}, référence retirée du catalogue`
          : `${quantity} ${productName} sorti${quantity > 1 ? "s" : ""} du stock`
      );
      setOpen(false);
      reset();
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la déclaration");
    } finally {
      setIsPending(false);
    }
  };

  if (availableStock <= 0) return null;

  return (
    <>
      <Button variant="outline" size="sm" className="h-8" onClick={() => setOpen(true)}>
        <PackageMinus className="size-3.5" />
        Déclarer une perte
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Déclarer une perte — {productName}</AlertDialogTitle>
            <AlertDialogDescription>
              Cassé, perdu ou volé : les exemplaires sortent du stock et la sortie apparaît dans les
              mouvements, avec votre motif.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Combien. Le nombre est la première question, il se règle au pouce. */}
          <div className="space-y-2">
            <Label>Combien en avez-vous perdu ?</Label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="Un de moins"
                className="flex size-10 items-center justify-center rounded-full border bg-card transition-colors hover:bg-muted disabled:opacity-30"
              >
                <Minus className="size-4" />
              </button>
              <Input
                type="number"
                min={1}
                max={availableStock}
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.max(1, Math.min(parseInt(e.target.value) || 1, availableStock)))
                }
                className="h-12 w-20 bg-white text-center font-heading text-2xl font-semibold tabular-nums dark:bg-card [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(q + 1, availableStock))}
                disabled={quantity >= availableStock}
                aria-label="Un de plus"
                className="flex size-10 items-center justify-center rounded-full border bg-card transition-colors hover:bg-muted disabled:opacity-30"
              >
                <Plus className="size-4" />
              </button>
              <span className="text-sm text-muted-foreground tabular-nums">
                sur {availableStock} en stock
              </span>
            </div>
          </div>

          {/* Pourquoi. */}
          <div className="space-y-2">
            <Label htmlFor="loss-reason">Que s&apos;est-il passé ?</Label>
            <Textarea
              id="loss-reason"
              autoFocus
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isPending}
              placeholder="Cassée sur le chantier de Nantes, volée dans le camion…"
            />
            <p className="text-xs text-muted-foreground">
              Obligatoire. C&apos;est ce qui expliquera la ligne dans les mouvements.
            </p>
          </div>

          {/* La suite du catalogue — posée seulement quand il ne reste rien.
              Tant qu'il subsiste un exemplaire, la question ne se pose pas. */}
          {losingEverything && (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/40 p-3">
              <Checkbox
                checked={alsoArchive}
                onCheckedChange={(v) => setAlsoArchive(v === true)}
                disabled={isPending}
                className="mt-0.5"
              />
              <span className="text-sm">
                <span className="font-medium">On ne rachètera pas cette référence</span>
                <span className="block text-muted-foreground">
                  Elle sortira du catalogue et rejoindra les archives, avec ce motif. Sans cette
                  case, la fiche reste en place, prête pour un rachat.
                </span>
              </span>
            </label>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Déclarer {quantity} perdu{quantity > 1 ? "s" : ""}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
