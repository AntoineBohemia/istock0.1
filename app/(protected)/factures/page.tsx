"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  FileText,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
} from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/search-input";
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

import { useOrganizationStore } from "@/lib/stores/organization-store";
import { usePurchaseInvoices } from "@/hooks/queries";
import { useDeletePurchaseInvoice } from "@/hooks/mutations";
import {
  getInvoiceSignedUrl,
  type PurchaseInvoice,
} from "@/lib/supabase/queries/purchase-invoices";
import NewInvoiceDialog from "@/components/new-invoice-dialog";
import EditInvoiceDialog from "./edit-invoice-dialog";
import InvoiceLines from "./invoice-lines";
import { cn } from "@/lib/utils";

const fmtMoney = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

export default function InvoicesPage() {
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();
  const { data: invoices = [], isLoading } = usePurchaseInvoices(currentOrganization?.id);
  const deleteMutation = useDeletePurchaseInvoice();

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState<PurchaseInvoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseInvoice | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [openingId, setOpeningId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return invoices;
    const q = search.toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.reference.toLowerCase().includes(q) ||
        (inv.supplier?.name ?? "").toLowerCase().includes(q)
    );
  }, [invoices, search]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** Le bucket est privé : on génère un lien temporaire au moment du clic */
  const openInvoiceFile = async (invoice: PurchaseInvoice) => {
    if (!invoice.file_path) return;
    setOpeningId(invoice.id);
    try {
      const url = await getInvoiceSignedUrl(invoice.file_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Facture indisponible");
    } finally {
      setOpeningId(null);
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(
      { id: deleteTarget.id, filePath: deleteTarget.file_path },
      {
        onSuccess: () => {
          toast.success("Facture supprimée");
          setDeleteTarget(null);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur"),
      }
    );
  };

  if (isLoading || isOrgLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-full rounded-md" />
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      {/* En-tête */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Factures</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Une facture peut couvrir plusieurs achats.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Nouvelle facture
        </Button>
      </div>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Rechercher par numéro ou fournisseur…"
        className="bg-white dark:bg-card"
      />

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted mb-3">
              <ReceiptText className="size-6 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold">
              {search ? "Aucune facture ne correspond" : "Aucune facture"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
              {search
                ? "Essayez un autre numéro ou fournisseur."
                : "Enregistrez vos factures d'achat, puis rattachez-y les produits reçus."}
            </p>
            {!search && (
              <Button className="mt-5" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                Nouvelle facture
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((invoice) => {
            const isExpanded = expanded.has(invoice.id);
            return (
              <div key={invoice.id} className="rounded-xl border bg-card overflow-hidden">
                <div className="flex items-start gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(invoice.id)}
                    className="flex flex-1 items-start gap-3 text-left min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-md cursor-pointer"
                  >
                    <ChevronDown
                      className={cn(
                        "size-4 mt-1 shrink-0 text-muted-foreground transition-transform duration-200",
                        !isExpanded && "-rotate-90"
                      )}
                    />
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-heading font-semibold text-[15px]">
                          {invoice.reference}
                        </span>
                        {invoice.supplier?.name && (
                          <span className="text-sm text-muted-foreground truncate">
                            {invoice.supplier.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground tabular-nums">
                        <span>{fmtDate(invoice.invoice_date)}</span>
                        {invoice.total_amount != null && (
                          <span className="font-semibold text-foreground">
                            {fmtMoney(invoice.total_amount)}
                          </span>
                        )}
                        {invoice.file_path ? (
                          <span className="inline-flex items-center gap-1 text-foreground/70">
                            <Paperclip className="size-3" />
                            PDF
                          </span>
                        ) : (
                          <span className="text-attention">Sans fichier</span>
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    {invoice.file_path && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={openingId === invoice.id}
                        onClick={() => openInvoiceFile(invoice)}
                      >
                        {openingId === invoice.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <FileText className="size-3.5" />
                        )}
                        Ouvrir
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      title="Modifier"
                      onClick={() => setEditInvoice(invoice)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Supprimer"
                      onClick={() => setDeleteTarget(invoice)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {isExpanded && currentOrganization?.id && (
                  <InvoiceLines invoiceId={invoice.id} organizationId={currentOrganization.id} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-center tabular-nums">
          {filtered.length} sur {invoices.length} facture{invoices.length > 1 ? "s" : ""}
        </p>
      )}

      {currentOrganization?.id && (
        <NewInvoiceDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          organizationId={currentOrganization.id}
          onCreated={() => {
            /* la liste se rafraîchit via l'invalidation du cache */
          }}
        />
      )}

      {editInvoice && (
        <EditInvoiceDialog
          open
          onOpenChange={(o) => !o && setEditInvoice(null)}
          invoice={editInvoice}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette facture ?</AlertDialogTitle>
            <AlertDialogDescription>
              La facture <strong>{deleteTarget?.reference}</strong> et son fichier seront supprimés.
              Les achats qu&apos;elle couvrait sont conservés, mais ne seront plus rattachés à
              aucune facture.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
