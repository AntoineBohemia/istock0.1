"use client";

import { useMemo } from "react";
import Image from "next/image";
import { Loader2, History, ImageIcon, Package, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { TechnicianStockMovement } from "@/lib/supabase/queries/technicians";
import { useTechnicianMovements } from "@/hooks/queries";

interface TechnicianHistoryProps {
  technicianId: string;
}

interface RestockSession {
  id: string;
  date: Date;
  movements: TechnicianStockMovement[];
  totalItems: number;
}

function groupMovementsIntoSessions(
  movements: TechnicianStockMovement[]
): RestockSession[] {
  if (movements.length === 0) return [];

  const sessions: RestockSession[] = [];
  let currentSession: TechnicianStockMovement[] = [];
  let sessionStartTime: Date | null = null;

  const sortedMovements = [...movements].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  for (const movement of sortedMovements) {
    const movementTime = new Date(movement.created_at);

    if (sessionStartTime === null) {
      currentSession = [movement];
      sessionStartTime = movementTime;
    } else {
      const timeDiff = Math.abs(
        sessionStartTime.getTime() - movementTime.getTime()
      );
      if (timeDiff <= 60000) {
        currentSession.push(movement);
      } else {
        sessions.push({
          id: currentSession[0].id,
          date: sessionStartTime,
          movements: currentSession,
          totalItems: currentSession.reduce((sum, m) => sum + m.quantity, 0),
        });
        currentSession = [movement];
        sessionStartTime = movementTime;
      }
    }
  }

  if (currentSession.length > 0 && sessionStartTime) {
    sessions.push({
      id: currentSession[0].id,
      date: sessionStartTime,
      movements: currentSession,
      totalItems: currentSession.reduce((sum, m) => sum + m.quantity, 0),
    });
  }

  return sessions;
}

export default function TechnicianHistory({
  technicianId,
}: TechnicianHistoryProps) {
  const { data: movements = [], isLoading } =
    useTechnicianMovements(technicianId);
  const prefersReducedMotion = useReducedMotion();

  const sessions = useMemo(
    () => groupMovementsIntoSessions(movements),
    [movements]
  );
  const totalItems = movements.reduce((sum, m) => sum + m.quantity, 0);

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-muted mb-4">
            <History className="size-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">Aucun historique</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Les mouvements apparaîtront ici lorsque des produits seront envoyés
            à ce technicien.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <p className="text-sm text-muted-foreground tabular-nums px-1">
        {sessions.length} restock{sessions.length > 1 ? "s" : ""} ·{" "}
        <span className="font-heading font-semibold text-foreground">
          {totalItems}
        </span>{" "}
        items au total
      </p>

      {/* Collapsible sessions */}
      <div className="rounded-xl border bg-card overflow-hidden divide-y">
        {sessions.map((session, sessionIndex) => (
          <Collapsible key={session.id} defaultOpen={sessionIndex === 0}>
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.25,
                delay: prefersReducedMotion ? 0 : sessionIndex * 0.03,
              }}
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer select-none">
                <div className="flex items-center gap-3">
                  <ChevronRight className="size-4 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-90" />
                  <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 shrink-0">
                    <Package className="size-3.5 text-primary" />
                  </div>
                  <span className="font-medium text-sm">
                    {session.date.toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {" · "}
                    {session.date.toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    {session.movements.length} produit
                    {session.movements.length > 1 ? "s" : ""}
                  </span>
                  <span className="font-heading font-bold text-standard text-sm tabular-nums">
                    +{session.totalItems}
                  </span>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="divide-y border-t">
                  {session.movements.map((movement) => (
                    <div
                      key={movement.id}
                      className="flex items-center justify-between pl-14 pr-4 py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <figure className="flex size-8 items-center justify-center rounded-md border bg-muted shrink-0 overflow-hidden">
                          {movement.product?.image_url ? (
                            <Image
                              src={movement.product.image_url}
                              width={32}
                              height={32}
                              alt={movement.product.name}
                              className="size-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="size-3.5 text-muted-foreground" />
                          )}
                        </figure>
                        <div>
                          <p className="font-medium text-sm leading-tight">
                            {movement.product?.name || "Produit supprimé"}
                          </p>
                          {movement.product?.sku && (
                            <p className="text-[11px] text-muted-foreground font-mono">
                              {movement.product.sku}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="font-heading font-bold tabular-nums text-sm text-standard">
                        +{movement.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </motion.div>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}
