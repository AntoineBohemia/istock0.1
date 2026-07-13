"use client";

import { useProductMovements } from "@/hooks/queries/use-stock-movements";
import { MOVEMENT_TYPE_LABELS } from "@/lib/supabase/queries/stock-movements";
import { cn } from "@/lib/utils";

interface RecentMovementsProps {
  productId: string;
}

const fmtPrice = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "à l'instant";
  if (diffMins < 60) return `il y a ${diffMins} min`;
  if (diffHours < 24) {
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "hier";
  if (diffDays < 7) return `il y a ${diffDays}j`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
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
        <div className="px-5 pb-4 text-sm text-muted-foreground">Chargement…</div>
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
                <th className="px-3 py-2 text-right font-medium">Prix/u</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-5 py-2 text-right font-medium">Date</th>
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

                const detail = techName || orgName || "—";

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
                    <td className="px-3 py-3 max-w-[200px]">
                      <span className="truncate block font-medium">{detail}</span>
                    </td>

                    {/* Unit price */}
                    <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums text-muted-foreground">
                      {unitPrice != null ? fmtPrice(unitPrice) : "—"}
                    </td>

                    {/* Total */}
                    <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums font-medium">
                      {totalValue != null ? fmtPrice(totalValue) : "—"}
                    </td>

                    {/* Date */}
                    <td className="px-5 py-3 whitespace-nowrap text-right text-xs text-muted-foreground tabular-nums">
                      {m.created_at ? formatRelativeTime(m.created_at) : ""}
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
