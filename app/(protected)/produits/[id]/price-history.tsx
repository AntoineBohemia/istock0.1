"use client";

import { TrendingDown, TrendingUp } from "lucide-react";

import { useProductPurchasePrices } from "@/hooks/queries/use-stock-movements";
import type { PurchasePriceEntry } from "@/lib/supabase/queries/stock-movements";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const fmt = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

/** Une periode pendant laquelle le produit a ete paye au meme prix. */
interface PricePeriod {
  price: number;
  supplierNames: string[];
  from: string;
  to: string;
  purchases: number;
}

/**
 * Regroupe les achats consecutifs au meme prix.
 *
 * La liste des achats un par un fait doublon avec le journal des mouvements,
 * juste en dessous. Ce qu'on veut savoir ici est autre chose : a combien on
 * l'a paye pendant une periode, puis pendant la suivante. Seuls les
 * changements de prix comptent.
 *
 * Les achats arrivent du plus recent au plus ancien ; les periodes sortent
 * dans le meme ordre.
 */
function groupByPrice(rows: PurchasePriceEntry[]): PricePeriod[] {
  const periods: PricePeriod[] = [];

  for (const row of rows) {
    const current = periods[periods.length - 1];
    // Comparaison au centime : deux achats a 12,50 appartiennent a la meme
    // periode meme si la base les stocke avec des decimales differentes.
    const samePrice = current && Math.abs(current.price - row.price) < 0.005;

    if (samePrice) {
      // La liste descend dans le temps : chaque nouvel achat recule le debut.
      current.from = row.purchased_at;
      current.purchases += 1;
      if (row.supplier_name && !current.supplierNames.includes(row.supplier_name)) {
        current.supplierNames.push(row.supplier_name);
      }
    } else {
      periods.push({
        price: row.price,
        supplierNames: row.supplier_name ? [row.supplier_name] : [],
        from: row.purchased_at,
        to: row.purchased_at,
        purchases: 1,
      });
    }
  }

  return periods;
}

/**
 * Evolution du prix d'achat.
 *
 * Le bloc listait l'historique du prix catalogue et disparaissait entierement
 * tant qu'il n'y avait qu'un seul prix — donc la plupart du temps. Il ne
 * disait pas non plus chez qui le produit avait ete achete, alors que c'est
 * la question : a combien je l'ai, et par quel fournisseur.
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
  const periods = groupByPrice(purchases ?? []);
  const prices = periods.map((p) => p.price);
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
        {periods.length > 1 && min !== max && (
          <p className="text-xs text-muted-foreground tabular-nums">
            de {fmt(min)} à {fmt(max)}
          </p>
        )}
      </div>

      {periods.length === 0 ? (
        <p className="px-5 pb-4 text-sm text-muted-foreground">
          Aucun achat enregistré avec un prix. Renseignez le prix unitaire lors d&apos;une entrée de
          stock pour suivre son évolution.
        </p>
      ) : (
        <div className="divide-y">
          {periods.map((period, i) => {
            // Comparaison a la periode precedente : la liste descend dans le
            // temps, la precedente est donc la ligne suivante.
            const prev = periods[i + 1];
            const diff = prev ? period.price - prev.price : 0;
            const isUp = diff > 0.005;
            const isDown = diff < -0.005;
            const isCurrent = i === 0;
            const sameDay = period.from === period.to;

            return (
              <div
                key={`${period.price}-${period.to}`}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  {/* La periode d'abord : c'est « depuis quand je paie ce
                      prix » qui interesse, le fournisseur vient ensuite. */}
                  <p className="text-sm font-medium tabular-nums">
                    {isCurrent
                      ? `Depuis le ${fmtDate(period.from)}`
                      : sameDay
                        ? fmtDate(period.from)
                        : `Du ${fmtDate(period.from)} au ${fmtDate(period.to)}`}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {period.supplierNames.length
                      ? period.supplierNames.join(" · ")
                      : "Fournisseur non renseigné"}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
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
                    {fmt(period.price)}
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
