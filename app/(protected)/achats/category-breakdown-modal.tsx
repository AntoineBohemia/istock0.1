"use client";

import { useQuery } from "@tanstack/react-query";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getPurchasesByCategory } from "@/lib/supabase/queries/stock-movements";

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

interface CategoryBreakdownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  year: number;
  /** null = toutes societes (cumul), ignore en mode stock */
  organizationId: string | null;
  mode: "purchases" | "stock";
}

/**
 * Detail par categorie derriere une carte de synthese.
 *
 * Une carte donne un total sans dire de quoi il est fait : « 57 211 EUR
 * d'achats » n'indique pas si c'est de la peinture ou de l'outillage.
 */
export default function CategoryBreakdownModal({
  open,
  onOpenChange,
  title,
  year,
  organizationId,
  mode,
}: CategoryBreakdownModalProps) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["purchases-by-category", year, organizationId, mode],
    queryFn: () => getPurchasesByCategory(year, organizationId, mode),
    // Inutile d'interroger tant que la modale n'est pas ouverte
    enabled: open,
  });

  const total = data.reduce((s, r) => s + r.total, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0 flex flex-col max-h-[85vh]">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Répartition par catégorie ·{" "}
            <span className="font-heading font-semibold text-foreground tabular-nums">
              {fmt(total)}
            </span>
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto border-t">
          {isLoading ? (
            <div className="p-5 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Aucun achat sur cette période.
            </p>
          ) : (
            <div className="divide-y">
              {data.map((row) => {
                // Part de la categorie : une liste de montants seuls oblige a
                // tout lire pour reperer les postes dominants.
                const share = total > 0 ? (row.total / total) * 100 : 0;
                return (
                  <div key={row.category_name} className="px-5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium truncate">{row.category_name}</span>
                      <span className="font-heading text-sm font-semibold tabular-nums shrink-0">
                        {fmt(row.total)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-foreground/70"
                          style={{ width: `${Math.max(share, 2)}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 w-16 text-right">
                        {share.toFixed(0)} % · {row.quantity}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
