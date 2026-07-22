"use client";

import { TrendingDown, TrendingUp } from "lucide-react";

import { useProductPurchasePrices } from "@/hooks/queries/use-stock-movements";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const fmt = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

/**
 * Prix d'achat du produit, achat par achat.
 *
 * Le bloc listait l'historique du prix catalogue et disparaissait entierement
 * tant qu'il n'y avait qu'un seul prix — donc la plupart du temps. Il ne
 * disait pas non plus chez qui le produit avait ete achete, alors que c'est
 * la question : a combien je l'ai, et par quel fournisseur.
 *
 * La source est desormais les entrees de stock, qui portent le prix paye et
 * le fournisseur. Une ligne par achat.
 */
export default function PriceHistory({ productId }: { productId: string }) {
  const { data: purchases, isLoading } = useProductPurchasePrices(productId);

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 pt-4 pb-2">
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="divide-y">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Le bloc reste visible meme sans achat : son absence laissait croire que la
  // fonction n'existait pas, alors qu'il n'y avait simplement rien a montrer.
  const rows = purchases ?? [];
  const prices = rows.map((r) => r.price);
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 0;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50">
          Prix d&apos;achat
        </p>
        {/* L'ecart entre le meilleur et le pire prix se lit d'un coup — c'est
            lui qui declenche une negociation ou un changement de fournisseur. */}
        {rows.length > 1 && min !== max && (
          <p className="text-xs text-muted-foreground tabular-nums">
            de {fmt(min)} à {fmt(max)}
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="px-5 pb-4 text-sm text-muted-foreground">
          Aucun achat enregistré avec un prix. Renseignez le prix unitaire lors d&apos;une entrée de
          stock pour suivre son évolution.
        </p>
      ) : (
        <div className="divide-y">
          {rows.map((row, i) => {
            // Comparaison a l'achat precedent : la liste est du plus recent au
            // plus ancien, le precedent est donc la ligne suivante.
            const prev = rows[i + 1];
            const diff = prev ? row.price - prev.price : 0;
            const isUp = diff > 0.005;
            const isDown = diff < -0.005;
            const isBest = rows.length > 1 && min !== max && row.price === min;

            return (
              <div key={row.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {row.supplier_name ?? "Fournisseur non renseigné"}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {fmtDate(row.purchased_at)} · {row.quantity} unité
                    {row.quantity > 1 ? "s" : ""}
                    {row.organization_name ? ` · ${row.organization_name}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {isBest && (
                    <span className="rounded-full bg-standard-bg px-2 py-0.5 text-[11px] font-medium text-standard">
                      Meilleur prix
                    </span>
                  )}
                  {prev && (isUp || isDown) && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums",
                        isUp ? "text-critique" : "text-standard"
                      )}
                    >
                      {isUp ? (
                        <TrendingUp className="size-3" />
                      ) : (
                        <TrendingDown className="size-3" />
                      )}
                      {isUp ? "+" : ""}
                      {fmt(diff)}
                    </span>
                  )}
                  <span className="font-heading text-base font-semibold tabular-nums">
                    {fmt(row.price)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
