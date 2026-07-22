"use client";

import { useQuery } from "@tanstack/react-query";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getPurchasesByCategory } from "@/lib/supabase/queries/stock-movements";
import { cn } from "@/lib/utils";

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
  const totalUnits = data.reduce((s, r) => s + r.quantity, 0);
  // Le plus gros poste, calcule et non deduit de l'ordre : la requete trie par
  // montant decroissant, mais faire dependre la longueur des barres de cet
  // ordre les rendrait fausses le jour ou le tri changerait.
  const maxTotal = data.reduce((m, r) => Math.max(m, r.total), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0 flex flex-col max-h-[85vh]">
        {/* Le total est le sujet : il etait glisse dans une phrase, a la meme
            taille que le reste. On vient verifier un chiffre, il doit se lire
            sans etre cherche. */}
        <DialogHeader className="px-6 pt-6 pb-4 space-y-0">
          <DialogTitle className="text-sm font-medium text-muted-foreground">{title}</DialogTitle>
          <p className="font-heading text-3xl font-bold tabular-nums leading-none pt-1.5">
            {fmt(total)}
          </p>
          <p className="text-sm text-muted-foreground pt-1.5">
            {data.length} catégorie{data.length > 1 ? "s" : ""}
            {totalUnits > 0 && ` · ${totalUnits.toLocaleString("fr-FR")} unités`}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto border-t">
          {isLoading ? (
            <div className="divide-y">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="px-6 py-4 space-y-2">
                  <div className="flex items-baseline justify-between gap-4">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <Skeleton className="h-1.5 w-full rounded-full" />
                  <Skeleton className="h-3 w-28" />
                </div>
              ))}
            </div>
          ) : data.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Aucun achat sur cette période.
            </p>
          ) : (
            <div className="divide-y">
              {data.map((row) => {
                // La barre se mesure au poste le plus lourd et non au total :
                // rapportees a 100 %, huit categories donnent huit traits
                // minuscules, impossibles a comparer entre eux.
                const share = total > 0 ? (row.total / total) * 100 : 0;
                const relative = maxTotal > 0 ? (row.total / maxTotal) * 100 : 0;
                const isTop = row.total === maxTotal;

                return (
                  <div key={row.category_name} className="px-6 py-4">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="min-w-0 flex-1 truncate text-base font-medium">
                        {row.category_name}
                      </span>
                      <span className="shrink-0 font-heading text-lg font-semibold tabular-nums">
                        {fmt(row.total)}
                      </span>
                    </div>

                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/[0.06]">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          isTop ? "bg-foreground/60" : "bg-foreground/30"
                        )}
                        style={{ width: `${Math.max(relative, 2)}%` }}
                      />
                    </div>

                    {/* Les unites sont nommees : « 12 % · 340 » laissait
                        deviner de quoi parlaient ces 340. */}
                    <p className="mt-1.5 text-sm text-muted-foreground tabular-nums">
                      {share.toFixed(0)} % du total
                      {row.quantity > 0 &&
                        ` · ${row.quantity.toLocaleString("fr-FR")} unité${row.quantity > 1 ? "s" : ""}`}
                    </p>
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
