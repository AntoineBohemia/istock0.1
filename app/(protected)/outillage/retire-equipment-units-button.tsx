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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOrganizations } from "@/hooks/queries";
import { useCreateStockExit } from "@/hooks/mutations";
import { activeOrganizations } from "@/lib/supabase/queries/organizations";
import { maxSingleOrgStock, pickExitSource, type OrgStock } from "@/lib/utils/exit-source";
import { queryKeys } from "@/lib/query-keys";

interface RetireEquipmentUnitsButtonProps {
  productId: string;
  productName: string;
  /** Unités en stock, prêts non compris */
  availableStock: number;
  orgStock: { organization_id: string; stock_current: number }[];
}

/**
 * Retirer des exemplaires d'un outil.
 *
 * Un outil casse, perdu ou vole restait compte indefiniment : il ne pouvait
 * qu'entrer en stock, partir chez un technicien, puis revenir. Archiver n'y
 * repondait pas — cela retire la reference entiere du catalogue, les quinze
 * exemplaires d'un coup, alors qu'on veut en sortir deux.
 *
 * Le retrait est donc une sortie de stock ordinaire, avec son motif. La
 * societe debitee suit la meme regle que partout : celle qui en a le moins.
 */
export default function RetireEquipmentUnitsButton({
  productId,
  productName,
  availableStock,
  orgStock,
}: RetireEquipmentUnitsButtonProps) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();
  const createExit = useCreateStockExit();
  const { data: allOrgs } = useOrganizations();
  const userOrgs = activeOrganizations(allOrgs ?? []);

  // Ventilation nommee, limitee aux societes de l'application : la base garde
  // des organisations de test qui ne doivent jamais etre debitees.
  const named: OrgStock[] = userOrgs.flatMap((org) => {
    const row = orgStock.find((x) => x.organization_id === org.id);
    return row ? [{ id: org.id, name: org.name, stock: row.stock_current }] : [];
  });

  const source = pickExitSource(named, quantity);
  // Le plafond est le stock d'une seule societe : un retrait ne se decoupe pas.
  const ceiling = named.length > 0 ? maxSingleOrgStock(named) : availableStock;
  const canRetire = reason.trim().length > 0 && quantity >= 1 && quantity <= ceiling && !!source;

  const handleRetire = () => {
    if (!canRetire || !source) return;
    createExit.mutate(
      {
        organizationId: source.id,
        productId,
        quantity,
        // Ce n'est pas un technicien qui l'emporte : l'outil quitte le stock
        // sans destinataire. Le motif dit le reste.
        type: "exit_anonymous",
        note: reason.trim(),
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.equipment.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.movements.all });
          toast.success(
            `${quantity} ${quantity > 1 ? "exemplaires retirés" : "exemplaire retiré"} — ${source.name}`
          );
          setOpen(false);
          setQuantity(1);
          setReason("");
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Erreur lors du retrait");
        },
      }
    );
  };

  if (availableStock <= 0) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={() => setOpen(true)}
        title="Retirer des exemplaires cassés, perdus ou volés"
      >
        <PackageMinus className="size-3.5" />
        Retirer
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setQuantity(1);
            setReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer des exemplaires de {productName}</AlertDialogTitle>
            <AlertDialogDescription>
              Les exemplaires sortent du stock, la fiche reste au catalogue. Pour retirer la
              référence entière, c&apos;est « Archiver ».
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Le nombre est le sujet : il se règle au pouce, pas au clavier. */}
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Retirer une unité"
              className="flex size-10 items-center justify-center rounded-full border bg-card transition-colors hover:bg-muted disabled:opacity-30"
            >
              <Minus className="size-4" />
            </button>
            <Input
              type="number"
              min={1}
              max={ceiling}
              value={quantity}
              onChange={(e) =>
                setQuantity(Math.max(1, Math.min(parseInt(e.target.value) || 1, ceiling)))
              }
              className="h-12 w-20 bg-white text-center font-heading text-2xl font-semibold tabular-nums dark:bg-card [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(q + 1, ceiling))}
              disabled={quantity >= ceiling}
              aria-label="Ajouter une unité"
              className="flex size-10 items-center justify-center rounded-full border bg-card transition-colors hover:bg-muted disabled:opacity-30"
            >
              <Plus className="size-4" />
            </button>
          </div>

          {/* Qui est débité. L'utilisateur ne l'a pas choisi : la règle du
              « moins fourni » l'a désigné, comme pour toute sortie. */}
          {source && (
            <p className="text-center text-sm text-muted-foreground">
              Retiré du stock <span className="font-medium text-foreground">{source.name}</span> —{" "}
              {source.stock} en stock
              {named.length > 1 && " (la société qui en a le moins)"}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="retire-reason">Motif du retrait</Label>
            <Textarea
              id="retire-reason"
              autoFocus
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={createExit.isPending}
              placeholder="Cassé sur le chantier de Nantes, perdu, volé dans le camion…"
            />
            <p className="text-xs text-muted-foreground">
              Obligatoire. C&apos;est ce qui expliquera la ligne dans les mouvements.
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={createExit.isPending}>Annuler</AlertDialogCancel>
            <Button onClick={handleRetire} disabled={!canRetire || createExit.isPending}>
              {createExit.isPending && <Loader2 className="size-4 animate-spin" />}
              Retirer {quantity} exemplaire{quantity > 1 ? "s" : ""}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
