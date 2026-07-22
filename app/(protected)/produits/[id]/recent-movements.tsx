"use client";

import { useProductMovements } from "@/hooks/queries/use-stock-movements";
import { MOVEMENT_TYPE_LABELS } from "@/lib/supabase/queries/stock-movements";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface RecentMovementsProps {
  productId: string;
}

const fmtPrice = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

/**
 * Date d'un mouvement, en clair.
 *
 * L'affichage etait relatif — « il y a 3j », « hier », une heure seule pour la
 * journee en cours. Pratique pour juger de la fraicheur, inutilisable pour
 * tout le reste : on ne peut ni rapprocher une ligne d'une facture, ni la
 * citer, ni comparer deux mouvements sans compter sur ses doigts. Et la meme
 * ligne changeait de libelle d'un jour a l'autre.
 *
 * L'annee est omise quand c'est l'annee en cours : elle n'apprend rien et
 * allonge chaque ligne.
 */
function formatMovementDate(dateStr: string): string {
  const date = new Date(dateStr);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export default function RecentMovements({ productId }: RecentMovementsProps) {
  const { data: movements = [], isLoading } = useProductMovements(productId, 10);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 pt-4 pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50">
          Mouvements récents
        </p>
      </div>

      {isLoading ? (
        <div className="divide-y">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3">
              <Skeleton className="h-5 w-10" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-24 flex-1" />
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      ) : movements.length === 0 ? (
        <div className="px-5 pb-4 text-sm text-muted-foreground">Aucun mouvement enregistré</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-[11px] text-muted-foreground/70">
                <th className="px-5 py-2 text-left font-medium">Qté</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Détail</th>
                <th className="px-3 py-2 text-left font-medium">Prix/u</th>
                <th className="px-3 py-2 text-left font-medium">Total</th>
                <th className="px-5 py-2 text-left font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {movements.map((m) => {
                const isEntry = m.movement_type === "entry";
                const techName = m.technician
                  ? `${m.technician.first_name} ${m.technician.last_name}`
                  : null;
                const orgName = m.organization?.name;
                const unitPrice = m.unit_price;
                const totalValue = unitPrice ? unitPrice * m.quantity : null;

                // Entrée : société. Sortie : technicien (ou société pour une erreur stock),
                // avec la société en second si elle diffère (utile pour voir dans quelle
                // société la sortie a été puisée).
                const detailPrimary = isEntry ? orgName || "—" : techName || orgName || "—";
                const detailSecondary = !isEntry && techName && orgName ? orgName : null;

                return (
                  <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                    {/* Quantity */}
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span
                        className={cn(
                          "font-heading font-bold tabular-nums text-base",
                          isEntry ? "text-standard" : "text-critique"
                        )}
                      >
                        {isEntry ? "+" : "−"}
                        {m.quantity}
                      </span>
                    </td>

                    {/* Type */}
                    <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                      {MOVEMENT_TYPE_LABELS[m.movement_type]}
                    </td>

                    {/* Detail */}
                    <td className="px-3 py-3 max-w-[220px]">
                      <span className="truncate block font-medium">{detailPrimary}</span>
                      {detailSecondary && (
                        <span className="truncate block text-xs text-muted-foreground">
                          {detailSecondary}
                        </span>
                      )}
                    </td>

                    {/* Unit price */}
                    <td className="px-3 py-3 whitespace-nowrap tabular-nums text-muted-foreground">
                      {unitPrice != null ? fmtPrice(unitPrice) : "—"}
                    </td>

                    {/* Total */}
                    <td className="px-3 py-3 whitespace-nowrap tabular-nums font-medium">
                      {totalValue != null ? fmtPrice(totalValue) : "—"}
                    </td>

                    {/* Date */}
                    <td className="px-5 py-3 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                      {m.created_at ? formatMovementDate(m.created_at) : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
