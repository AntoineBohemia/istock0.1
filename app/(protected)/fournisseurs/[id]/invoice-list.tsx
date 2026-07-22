"use client";

import { useState } from "react";
import { ExternalLink, FileText, Loader2, Plus, ReceiptText, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useSupplierInvoices } from "@/hooks/queries/use-suppliers";
import { useDeletePurchaseInvoice } from "@/hooks/mutations";
import { getInvoiceFileUrl, type PurchaseInvoice } from "@/lib/supabase/queries/purchase-invoices";
import AddInvoiceDialog from "./add-invoice-dialog";

const fmtPrice = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

interface InvoiceListProps {
  supplierId: string;
  supplierName: string;
}

export default function InvoiceList({ supplierId, supplierName }: InvoiceListProps) {
  const { data: invoices = [], isLoading } = useSupplierInvoices(supplierId);
  const deleteMutation = useDeletePurchaseInvoice();

  const [addOpen, setAddOpen] = useState(false);
  const [toDelete, setToDelete] = useState<PurchaseInvoice | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const total = invoices.reduce((sum, i) => sum + (i.total_amount ?? 0), 0);

  // Le bucket est prive : l'URL n'existe qu'au moment du clic, et pour une
  // minute. Un `href` pose a l'avance serait deja perime.
  const handleOpen = async (invoice: PurchaseInvoice) => {
    if (!invoice.file_path) return;
    setOpeningId(invoice.id);
    try {
      const url = await getInvoiceFileUrl(invoice.file_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setOpeningId(null);
    }
  };

  const handleDelete = () => {
    if (!toDelete) return;
    deleteMutation.mutate(
      { id: toDelete.id, filePath: toDelete.file_path },
      {
        onSuccess: () => {
          toast.success("Facture supprimée");
          setToDelete(null);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Erreur");
          setToDelete(null);
        },
      }
    );
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-heading font-semibold text-sm">Factures</h2>
        <div className="flex items-center gap-3">
          {total > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {fmtPrice(total)} cumulés
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddOpen(true)}
            className="h-7 text-xs bg-white dark:bg-card"
          >
            <Plus className="size-3.5" />
            Ajouter
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border bg-card divide-y">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="size-9 rounded-lg shrink-0" />
              <Skeleton className="h-4 w-32 flex-1" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center rounded-xl border bg-card">
          <ReceiptText className="size-12 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground max-w-xs">
            Aucune facture enregistrée pour {supplierName}.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" />
            Ajouter une facture
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border bg-card divide-y overflow-hidden">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="group flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
                <FileText className="size-4 text-muted-foreground" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium truncate">{invoice.reference}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  {invoice.invoice_date ? fmtDate(invoice.invoice_date) : "Date non renseignée"}
                  {invoice.file_name && ` · ${invoice.file_name}`}
                </span>
              </span>

              <span className="shrink-0 text-sm font-heading font-bold tabular-nums">
                {invoice.total_amount != null ? fmtPrice(invoice.total_amount) : "—"}
              </span>

              <span className="flex shrink-0 items-center gap-1">
                {invoice.file_path && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-muted-foreground"
                    onClick={() => handleOpen(invoice)}
                    disabled={openingId === invoice.id}
                    title="Ouvrir le document"
                  >
                    {openingId === invoice.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <ExternalLink className="size-3.5" />
                    )}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                  onClick={() => setToDelete(invoice)}
                  title="Supprimer cette facture"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </span>
            </div>
          ))}
        </div>
      )}

      <AddInvoiceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        supplierId={supplierId}
        supplierName={supplierName}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette facture</AlertDialogTitle>
            <AlertDialogDescription>
              La facture {toDelete?.reference}
              {toDelete?.file_name ? " et son document" : ""} seront supprimés définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
