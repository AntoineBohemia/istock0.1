"use client";

import { useState } from "react";
import { Loader2, Paperclip } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSuppliers } from "@/hooks/queries";
import {
  createPurchaseInvoice,
  uploadInvoiceFile,
  type PurchaseInvoice,
} from "@/lib/supabase/queries/purchase-invoices";
import { cn } from "@/lib/utils";

interface NewInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  /** Fournisseur pré-sélectionné (celui du produit en cours, en général) */
  defaultSupplierId?: string | null;
  onCreated: (invoice: PurchaseInvoice) => void;
}

export default function NewInvoiceDialog({
  open,
  onOpenChange,
  organizationId,
  defaultSupplierId,
  onCreated,
}: NewInvoiceDialogProps) {
  const { data: suppliers = [] } = useSuppliers(organizationId);

  const [prevOpen, setPrevOpen] = useState(open);
  const [reference, setReference] = useState("");
  const [supplierId, setSupplierId] = useState(defaultSupplierId ?? "");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (open && !prevOpen) {
    setReference("");
    setSupplierId(defaultSupplierId ?? "");
    setInvoiceDate("");
    setTotalAmount("");
    setFile(null);
  }
  if (open !== prevOpen) setPrevOpen(open);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference.trim()) return;

    setIsSaving(true);
    try {
      const invoice = await createPurchaseInvoice({
        organization_id: organizationId,
        reference: reference.trim(),
        supplier_id: supplierId || null,
        invoice_date: invoiceDate || null,
        total_amount: totalAmount ? parseFloat(totalAmount) : null,
      });

      // Le fichier ne peut partir qu'après création : il a besoin de l'id
      if (file) {
        try {
          await uploadInvoiceFile(file, invoice.id);
        } catch {
          toast.error("Facture créée, mais le PDF n'a pas pu être envoyé");
        }
      }

      toast.success("Facture créée");
      onCreated(invoice);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 p-0 flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-semibold">Nouvelle facture</DialogTitle>
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
                placeholder="FA-2026-014"
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
                  placeholder="0.00"
                  className="bg-white dark:bg-card"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">
                Fichier (PDF ou image)
              </label>
              <label className="flex items-center gap-2 cursor-pointer rounded-md border border-dashed px-3 h-10 text-sm hover:bg-muted/40 transition-colors">
                <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                <span
                  className={cn("truncate", file ? "text-foreground" : "text-muted-foreground")}
                >
                  {file ? file.name : "Choisir un fichier"}
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
              disabled={isSaving}
              className="h-10 bg-white dark:bg-card"
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSaving || !reference.trim()} className="h-10">
              {isSaving && <Loader2 className="size-4 animate-spin" />}
              Créer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
