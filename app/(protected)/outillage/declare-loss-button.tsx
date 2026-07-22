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
import { useOrganizations } from "@/hooks/queries";
import { activeOrganizations } from "@/lib/supabase/queries/organizations";
import { archiveProduct } from "@/lib/supabase/queries/products";
import { createExit } from "@/lib/supabase/queries/stock-movements";
import { allocateLoss, type OrgStock } from "@/lib/utils/exit-source";
import { queryKeys } from "@/lib/query-keys";

interface DeclareLossButtonProps {
  productId: string;
  productName: string;
  /** Unités en stock, prêts non compris */
  availableStock: number;
  orgStock: { organization_id: string; stock_current: number }[];
  onDone: () => void;
}

/**
 * Déclarer une perte : cassé, perdu, volé.
 *
 * Deux boutons se partageaient ce geste — « Retirer » et « Archiver » — et
 * personne ne savait lequel prendre. Leur difference tenait pourtant en un mot :
 * une partie du stock, ou tout. Mais ce mot n'etait ecrit nulle part, et les
 * deux libelles decrivaient le mecanisme interne plutot que la situation vecue.
 *
 * Il n'y a donc plus qu'une action, qui pose les questions qu'on se pose deja :
 * combien, et pourquoi. La sortie du catalogue devient une consequence qu'on
 * accepte — une case a cocher, proposee au seul moment ou elle a un sens :
 * quand il ne reste plus rien.
 */
export default function DeclareLossButton({
  productId,
  productName,
  availableStock,
  orgStock,
  onDone,
}: DeclareLossButtonProps) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [alsoArchive, setAlsoArchive] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const queryClient = useQueryClient();
  const { data: allOrgs } = useOrganizations();
  const userOrgs = activeOrganizations(allOrgs ?? []);

  // Ventilation nommée, limitée aux sociétés de l'application : la base garde
  // des organisations de test qui ne doivent jamais être débitées.
  const named: OrgStock[] = userOrgs.flatMap((org) => {
    const row = orgStock.find((x) => x.organization_id === org.id);
    return row ? [{ id: org.id, name: org.name, stock: row.stock_current }] : [];
  });

  const ventilated = named.reduce((s, o) => s + o.stock, 0);
  const allocation = allocateLoss(named, quantity);
  const losingEverything = quantity >= ventilated && ventilated > 0;
  const canSubmit = reason.trim().length > 0 && allocation.length > 0 && !isPending;

  const reset = () => {
    setQuantity(1);
    setReason("");
    setAlsoArchive(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsPending(true);
    try {
      // Les sorties d'abord, l'archivage ensuite : si une sortie échoue, la
      // fiche reste au catalogue avec son stock — un état cohérent, qu'on peut
      // reprendre. L'inverse laisserait une fiche archivée au stock intact.
      for (const part of allocation) {
        await createExit(part.id, productId, part.quantity, "exit_anonymous", undefined, reason);
      }
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
                max={ventilated}
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.max(1, Math.min(parseInt(e.target.value) || 1, ventilated)))
                }
                className="h-12 w-20 bg-white text-center font-heading text-2xl font-semibold tabular-nums dark:bg-card [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(q + 1, ventilated))}
                disabled={quantity >= ventilated}
                aria-label="Un de plus"
                className="flex size-10 items-center justify-center rounded-full border bg-card transition-colors hover:bg-muted disabled:opacity-30"
              >
                <Plus className="size-4" />
              </button>
              <span className="text-sm text-muted-foreground tabular-nums">
                sur {ventilated} en stock
              </span>
            </div>

            {/* D'où sortent-ils. L'utilisateur ne l'a pas choisi : la règle du
                « moins fourni » l'a désigné, comme pour toute sortie. */}
            {allocation.length > 0 && named.length > 1 && (
              <p className="text-sm text-muted-foreground">
                Pris chez {allocation.map((a) => `${a.name} (${a.quantity})`).join(" puis ")}
              </p>
            )}
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
