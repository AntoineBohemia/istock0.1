
"use client";

import { useMemo } from "react";
import Image from "next/image";
import { Loader2, History, ImageIcon, Package } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

// Group movements that happened within 1 minute of each other as a single restock session
function groupMovementsIntoSessions(movements: TechnicianStockMovement[]): RestockSession[] {
  if (movements.length === 0) return [];

  const sessions: RestockSession[] = [];
  let currentSession: TechnicianStockMovement[] = [];
  let sessionStartTime: Date | null = null;

  // Sort by date descending (most recent first)
  const sortedMovements = [...movements].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  for (const movement of sortedMovements) {
    const movementTime = new Date(movement.created_at);

    if (sessionStartTime === null) {
      currentSession = [movement];
      sessionStartTime = movementTime;
    } else {
      const timeDiff = Math.abs(sessionStartTime.getTime() - movementTime.getTime());
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
  const { data: movements = [], isLoading } = useTechnicianMovements(technicianId);

  const sessions = useMemo(() => groupMovementsIntoSessions(movements), [movements]);
  const totalItems = movements.reduce((sum, m) => sum + m.quantity, 0);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique des approvisionnements</CardTitle>
        <CardDescription>
          {sessions.length === 0
            ? "Aucun approvisionnement effectué"
            : `${sessions.length} restock(s) - ${totalItems} item(s) au total`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <History className="size-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">
              Aucun historique d&apos;approvisionnement disponible.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Les mouvements apparaîtront ici lorsque des produits seront
              envoyés à ce technicien.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {sessions.map((session) => (
              <div key={session.id}>
                {/* Session header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <Package className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">
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
                    <p className="text-xs text-muted-foreground">
                      {session.movements.length} produit{session.movements.length > 1 ? "s" : ""} • {session.totalItems} item{session.totalItems > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {/* Products list */}
                <div className="ml-10 space-y-2">
                  {session.movements.map((movement) => (
                    <div
                      key={movement.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <figure className="flex size-10 items-center justify-center rounded-lg border bg-muted">
                          {movement.product?.image_url ? (
                            <Image
                              src={movement.product.image_url}
                              width={40}
                              height={40}
                              alt={movement.product.name}
                              className="size-full rounded-lg object-cover"
                            />
                          ) : (
                            <ImageIcon className="size-5 text-muted-foreground" />
                          )}
                        </figure>
                        <div>
                          <p className="font-medium">
                            {movement.product?.name || "Produit supprimé"}
                          </p>
                          {movement.product?.sku && (
                            <p className="text-xs text-muted-foreground font-mono">
                              {movement.product.sku}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge variant="secondary">+{movement.quantity}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

