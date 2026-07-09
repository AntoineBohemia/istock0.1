"use client";

import { useProductMovements } from "@/hooks/queries/use-stock-movements";
import { MOVEMENT_TYPE_LABELS } from "@/lib/supabase/queries/stock-movements";
import { cn } from "@/lib/utils";

interface RecentMovementsProps {
  productId: string;
}

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
  const { data: movements = [], isLoading } = useProductMovements(productId, 5);

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
        <div className="divide-y">
          {movements.map((m) => {
            const isEntry = m.movement_type === "entry";
            const techName = m.technician
              ? `${m.technician.first_name} ${m.technician.last_name}`
              : null;

            let description: string;
            if (m.movement_type === "exit_technician" && techName) {
              description = `${techName} · sortie technicien`;
            } else {
              description = MOVEMENT_TYPE_LABELS[m.movement_type];
            }
            if (m.notes && m.notes !== "Annulation") {
              description += ` · ${m.notes}`;
            }

            return (
              <div key={m.id} className="flex items-center gap-3 px-5 py-2.5">
                <span
                  className={cn(
                    "font-heading font-bold tabular-nums text-sm w-10 text-right shrink-0",
                    isEntry ? "text-standard" : "text-critique"
                  )}
                >
                  {isEntry ? "+" : "−"}
                  {m.quantity}
                </span>
                <span className="text-sm truncate flex-1">{description}</span>
                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                  {m.created_at ? formatRelativeTime(m.created_at) : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
