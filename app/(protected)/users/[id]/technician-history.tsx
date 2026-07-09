"use client";

import { useMemo } from "react";
import Image from "next/image";
import { Loader2, History, ImageIcon, Package } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

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

      {/* Timeline */}
      <div className="space-y-4">
        {sessions.map((session, sessionIndex) => (
          <motion.div
            key={session.id}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              type: "spring",
              bounce: 0,
              duration: 0.35,
              delay: prefersReducedMotion ? 0 : sessionIndex * 0.05,
            }}
            className="rounded-xl border bg-card overflow-hidden"
          >
            {/* Session header */}
            <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                  <Package className="size-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">
                    {session.date.toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    {" à "}
                    {session.date.toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {session.movements.length} produit
                  {session.movements.length > 1 ? "s" : ""}
                </span>
                <span className="font-heading font-bold text-foreground text-sm tabular-nums">
                  +{session.totalItems}
                </span>
              </div>
            </div>

            {/* Products */}
            <div className="divide-y">
              {session.movements.map((movement) => (
                <div
                  key={movement.id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div className="flex items-center gap-3">
                    <figure className="flex size-9 items-center justify-center rounded-lg border bg-muted shrink-0 overflow-hidden">
                      {movement.product?.image_url ? (
                        <Image
                          src={movement.product.image_url}
                          width={36}
                          height={36}
                          alt={movement.product.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="size-4 text-muted-foreground" />
                      )}
                    </figure>
                    <div>
                      <p className="font-medium text-sm">
                        {movement.product?.name || "Produit supprimé"}
                      </p>
                      {movement.product?.sku && (
                        <p className="text-xs text-muted-foreground font-mono">
                          {movement.product.sku}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="font-heading font-bold tabular-nums text-standard">
                    +{movement.quantity}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
