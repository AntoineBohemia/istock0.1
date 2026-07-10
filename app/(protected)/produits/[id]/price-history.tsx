"use client";

import { useProductPriceHistory } from "@/hooks/queries/use-stock-movements";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export default function PriceHistory({ productId }: { productId: string }) {
  const { data: history, isLoading } = useProductPriceHistory(productId);

  if (isLoading || !history || history.length <= 1) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 pt-4 pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50">
          Historique des prix
        </p>
      </div>
      <div className="divide-y text-sm">
        {history.map((entry, i) => {
          const prev = history[i + 1];
          const diff = prev ? entry.price - prev.price : 0;
          const isUp = diff > 0;
          const isDown = diff < 0;

          return (
            <div key={entry.id} className="flex items-center justify-between px-5 py-2.5">
              <div className="flex items-center gap-2">
                {i === 0 ? (
                  <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-semibold">
                    Actuel
                  </span>
                ) : (
                  <span className="text-muted-foreground text-[13px]">
                    {format(new Date(entry.effective_from), "dd MMM yyyy", { locale: fr })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {prev && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 text-[11px] font-medium",
                      isUp && "text-critique",
                      isDown && "text-standard",
                      !isUp && !isDown && "text-muted-foreground"
                    )}
                  >
                    {isUp ? (
                      <TrendingUp className="size-3" />
                    ) : isDown ? (
                      <TrendingDown className="size-3" />
                    ) : (
                      <Minus className="size-3" />
                    )}
                    {isUp ? "+" : ""}
                    {fmt(diff)}
                  </span>
                )}
                <span className="font-semibold tabular-nums">{fmt(entry.price)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
