"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCreatePurchaseInvoice } from "@/hooks/mutations";
import { useOrganizationStore } from "@/lib/stores/organization-store";

interface AddInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: string;
  supplierName: string;
}

/** Meme liste que le bucket : refuser ici evite un aller-retour pour rien. */
const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.webp";
const MAX_SIZE = 10 * 1024 * 1024;

export default function AddInvoiceDialog({
  open,
  onOpenChange,
  supplierId,
  supplierName,
}: AddInvoiceDialogProps) {
  const orgId = useOrganizationStore((s) => s.currentOrganization?.id);
  const createMutation = useCreatePurchaseInvoice();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [reference, setReference] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const reset = () => {
    setReference("");
    setInvoiceDate("");
    setAmount("");
    setFile(null);
  };

  const parsedAmount = amount.trim() === "" ? null : Number(amount.replace(",", "."));
  const amountError =
    parsedAmount !== null && (!Number.isFinite(parsedAmount) || parsedAmount < 0)
      ? "Montant invalide"
      : null;

  // La reference est le seul champ vraiment obligatoire : c'est elle qui
  // permet de retrouver la facture chez le fournisseur.
  const canSubmit = reference.trim().length > 0 && !amountError && !createMutation.isPending;

  const handleFile = (f: File | null) => {
    if (f && f.size > MAX_SIZE) {
      toast.error("Fichier trop volumineux (10 Mo maximum)");
      return;
    }
    setFile(f);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !orgId) return;

    createMutation.mutate(
      {
        organizationId: orgId,
        supplierId,
        input: {
          reference,
          invoiceDate: invoiceDate || null,
          totalAmount: parsedAmount,
          file,
        },
      },
      {
        onSuccess: () => {
          toast.success("Facture enregistrée");
          reset();
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Erreur");
        },
      }
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-md gap-0 p-0 flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-semibold">Ajouter une facture</DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">{supplierName}</p>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="px-5 py-4 border-t space-y-4">
            <div>
              <label
                htmlFor="invoice-reference"
                className="text-xs font-medium text-muted-foreground mb-1 block"
              >
                Numéro de facture
              </label>
              <Input
                id="invoice-reference"
                autoFocus
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="FA-2026-0142"
                className="bg-white dark:bg-card"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="invoice-date"
                  className="text-xs font-medium text-muted-foreground mb-1 block"
                >
                  Date
                </label>
                <Input
                  id="invoice-date"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="bg-white dark:bg-card"
                />
              </div>
              <div>
                <label
                  htmlFor="invoice-amount"
                  className="text-xs font-medium text-muted-foreground mb-1 block"
                >
                  Montant TTC
                </label>
                <Input
                  id="invoice-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1 250,00"
                  className="bg-white dark:bg-card tabular-nums"
                />
              </div>
            </div>
            {amountError && <p className="text-[11px] text-destructive -mt-2">{amountError}</p>}

            <div>
              <span className="text-xs font-medium text-muted-foreground mb-1 block">Document</span>
              {file ? (
                <div className="flex items-center gap-2 rounded-md border bg-white dark:bg-card px-3 py-2">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => handleFile(null)}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Retirer le fichier"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                >
                  <Upload className="size-4" />
                  Joindre le PDF ou une photo
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Facultatif — PDF ou image, 10 Mo maximum.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t">
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
              className="h-10 bg-white dark:bg-card"
            >
              Annuler
            </Button>
            <Button type="submit" disabled={!canSubmit} className="h-10">
              {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
