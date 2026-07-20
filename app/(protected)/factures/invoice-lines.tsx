"use client";

import { useState } from "react";
import { Link2, Loader2, Unlink } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePurchaseInvoice } from "@/hooks/queries";
import { useLinkMovementToInvoice } from "@/hooks/mutations";
import { getUnlinkedEntries } from "@/lib/supabase/queries/purchase-invoices";

interface UnlinkedEntry {
  id: string;
  quantity: number;
  unit_price: number | null;
  created_at: string | null;
  product: { id: string; name: string; sku: string | null } | null;
}

const fmtMoney = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" })
    : "—";

export default function InvoiceLines({
  invoiceId,
  organizationId,
}: {
  invoiceId: string;
  organizationId: string;
}) {
  const { data: invoice, isLoading } = usePurchaseInvoice(invoiceId);
  const linkMutation = useLinkMovementToInvoice();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [candidates, setCandidates] = useState<UnlinkedEntry[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  // Chargé au clic plutôt que dans un effet : pas de rendu en cascade,
  // et on n'interroge la base que si l'utilisateur ouvre réellement la liste.
  const openPicker = async () => {
    setPickerOpen(true);
    setLoadingCandidates(true);
    try {
      setCandidates(await getUnlinkedEntries(organizationId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoadingCandidates(false);
    }
  };

  const attach = (movementId: string) => {
    linkMutation.mutate(
      { movementId, invoiceId },
      {
        onSuccess: () => {
          toast.success("Achat rattaché");
          setCandidates((prev) => prev.filter((c) => c.id !== movementId));
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur"),
      }
    );
  };

  const detach = (movementId: string) => {
    linkMutation.mutate(
      { movementId, invoiceId: null },
      {
        onSuccess: () => toast.success("Achat détaché"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur"),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="border-t px-4 py-3 space-y-2">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
      </div>
    );
  }

  const lines = invoice?.lines ?? [];
  const linesTotal = lines.reduce((s, l) => s + (l.unit_price ?? 0) * l.quantity, 0);

  return (
    <div className="border-t bg-muted/20">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
            Achats couverts
          </p>
          {lines.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {lines.length} ligne{lines.length > 1 ? "s" : ""} · {fmtMoney(linesTotal)}
            </span>
          )}
        </div>

        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Aucun achat rattaché à cette facture pour l&apos;instant.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {lines.map((line) => (
              <li key={line.id} className="flex items-center gap-3 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {line.product?.name ?? "Produit supprimé"}
                  </p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {fmtDate(line.created_at)}
                    {line.product?.sku ? ` · ${line.product.sku}` : ""}
                  </p>
                </div>
                <span className="text-sm tabular-nums shrink-0">
                  <span className="font-semibold">{line.quantity}</span>
                  {line.unit_price != null && (
                    <span className="text-muted-foreground">
                      {" × "}
                      {fmtMoney(line.unit_price)}
                    </span>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="Détacher de la facture"
                  disabled={linkMutation.isPending}
                  onClick={() => detach(line.id)}
                >
                  <Unlink className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {/* Rattacher un achat déjà enregistré */}
        <div className="mt-3">
          {!pickerOpen ? (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={openPicker}>
              <Link2 className="size-3.5" />
              Rattacher un achat existant
            </Button>
          ) : (
            <div className="rounded-lg border bg-card">
              <div className="flex items-center justify-between px-3 py-2 border-b">
                <span className="text-xs font-medium">Achats sans facture</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setPickerOpen(false)}
                >
                  Fermer
                </Button>
              </div>

              {loadingCandidates ? (
                <div className="px-3 py-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Chargement…
                </div>
              ) : candidates.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">
                  Tous les achats sont déjà rattachés à une facture.
                </p>
              ) : (
                <ul className="divide-y max-h-64 overflow-y-auto">
                  {candidates.map((entry) => (
                    <li key={entry.id} className="flex items-center gap-3 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">
                          {entry.product?.name ?? "Produit supprimé"}
                        </p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          {fmtDate(entry.created_at)} · {entry.quantity} u.
                          {entry.unit_price != null ? ` · ${fmtMoney(entry.unit_price)}` : ""}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="h-7 text-xs shrink-0"
                        disabled={linkMutation.isPending}
                        onClick={() => attach(entry.id)}
                      >
                        Rattacher
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
