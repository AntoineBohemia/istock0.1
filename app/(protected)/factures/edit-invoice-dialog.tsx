"use client";

import { useState } from "react";
import { Loader2, Paperclip } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSuppliers } from "@/hooks/queries";
import { useUpdatePurchaseInvoice } from "@/hooks/mutations";
import { uploadInvoiceFile, type PurchaseInvoice } from "@/lib/supabase/queries/purchase-invoices";
import { cn } from "@/lib/utils";

interface EditInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: PurchaseInvoice;
}

export default function EditInvoiceDialog({ open, onOpenChange, invoice }: EditInvoiceDialogProps) {
  const updateMutation = useUpdatePurchaseInvoice();
  const { data: suppliers = [] } = useSuppliers(invoice.organization_id);

  const [prevId, setPrevId] = useState(invoice.id);
  const [reference, setReference] = useState(invoice.reference);
  const [supplierId, setSupplierId] = useState(invoice.supplier_id ?? "");
  const [invoiceDate, setInvoiceDate] = useState(invoice.invoice_date ?? "");
  const [totalAmount, setTotalAmount] = useState(invoice.total_amount?.toString() ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (invoice.id !== prevId) {
    setPrevId(invoice.id);
    setReference(invoice.reference);
    setSupplierId(invoice.supplier_id ?? "");
    setInvoiceDate(invoice.invoice_date ?? "");
    setTotalAmount(invoice.total_amount?.toString() ?? "");
    setFile(null);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference.trim()) return;

    // Le fichier part en premier : si l'envoi échoue, on n'enregistre rien d'incohérent
    if (file) {
      setIsUploading(true);
      try {
        await uploadInvoiceFile(file, invoice.id);
      } catch (err) {
        setIsUploading(false);
        toast.error(err instanceof Error ? err.message : "Le fichier n'a pas pu être envoyé");
        return;
      }
      setIsUploading(false);
    }

    updateMutation.mutate(
      {
        id: invoice.id,
        reference: reference.trim(),
        supplier_id: supplierId || null,
        invoice_date: invoiceDate || null,
        total_amount: totalAmount ? parseFloat(totalAmount) : null,
      },
      {
        onSuccess: () => {
          toast.success("Facture mise à jour");
          onOpenChange(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur"),
      }
    );
  };

  const busy = updateMutation.isPending || isUploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 p-0 flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-semibold">Modifier la facture</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="px-5 py-3 border-t space-y-3">
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">
                Numéro de facture *
              </label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                required
                autoFocus
                className="bg-white dark:bg-card"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Fournisseur</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-white dark:bg-card px-3 text-sm"
              >
                <option value="">Aucun fournisseur</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Date</label>
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="bg-white dark:bg-card"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Montant HT</label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="bg-white dark:bg-card"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Fichier</label>
              <label className="flex items-center gap-2 cursor-pointer rounded-md border border-dashed px-3 h-10 text-sm hover:bg-muted/40 transition-colors">
                <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                <span
                  className={cn("truncate", file ? "text-foreground" : "text-muted-foreground")}
                >
                  {file
                    ? file.name
                    : invoice.file_name
                      ? `Remplacer « ${invoice.file_name} »`
                      : "Choisir un fichier"}
                </span>
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t">
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={busy}
              className="h-10 bg-white dark:bg-card"
            >
              Annuler
            </Button>
            <Button type="submit" disabled={busy || !reference.trim()} className="h-10">
              {busy && <Loader2 className="size-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
