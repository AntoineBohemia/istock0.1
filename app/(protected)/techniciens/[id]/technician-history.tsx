"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { History, ImageIcon } from "lucide-react";
import { SearchInput } from "@/components/search-input";

import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

interface Movement {
  id: string;
  product_id: string;
  quantity: number;
  created_at: string | null;
  product: {
    id: string;
    name: string;
    sku: string | null;
    image_url: string | null;
  } | null;
}

interface RestockSession {
  id: string;
  date: Date;
  movements: Movement[];
  totalItems: number;
}

function groupMovementsIntoSessions(movements: Movement[]): RestockSession[] {
  if (movements.length === 0) return [];

  const sessions: RestockSession[] = [];
  let currentSession: Movement[] = [];
  let sessionStartTime: Date | null = null;

  for (const movement of movements) {
    const movementTime = new Date(movement.created_at ?? 0);

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

interface TechnicianHistoryProps {
  movements: Movement[];
  year: number;
}

export default function TechnicianHistory({ movements, year }: TechnicianHistoryProps) {
  const [search, setSearch] = useState("");

  const allSessions = useMemo(() => groupMovementsIntoSessions(movements), [movements]);

  // Filter sessions that contain matching products
  const sessions = useMemo(() => {
    if (!search) return allSessions;
    const q = search.toLowerCase();
    return allSessions
      .map((session) => {
        const matchingMovements = session.movements.filter((m) => {
          const name = m.product?.name?.toLowerCase() || "";
          const sku = m.product?.sku?.toLowerCase() || "";
          return name.includes(q) || sku.includes(q);
        });
        if (matchingMovements.length === 0) return null;
        return {
          ...session,
          movements: matchingMovements,
          totalItems: matchingMovements.reduce((sum, m) => sum + m.quantity, 0),
        };
      })
      .filter(Boolean) as RestockSession[];
  }, [allSessions, search]);

  const totalItems = sessions.reduce((sum, s) => sum + s.totalItems, 0);

  if (movements.length === 0) {
    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-muted mb-4">
            <History className="size-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">Aucun historique en {year}</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Aucun mouvement enregistré pour ce technicien cette année.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Rechercher un produit..."
        className="bg-white dark:bg-card"
      />

      {/* Summary */}
      <p className="text-sm text-muted-foreground tabular-nums px-1">
        {sessions.length} réapprovisionnement{sessions.length > 1 ? "s" : ""} ·{" "}
        <span className="font-heading font-semibold text-foreground">{totalItems}</span> unités
        {search ? " (filtré)" : ` en ${year}`}
      </p>

      {/* Sessions or no results */}
      {sessions.length === 0 ? (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="py-12 text-center text-muted-foreground text-sm">
            Aucun réapprovisionnement contenant &quot;{search}&quot;.
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden divide-y">
          {sessions.map((session, sessionIndex) => (
            <Collapsible key={session.id} defaultOpen={sessionIndex === 0 || !!search}>
              <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer select-none">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-sm">
                    {session.date.toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                    <span className="text-muted-foreground font-normal">
                      {" · "}
                      {session.date.toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    {session.movements.length} produit
                    {session.movements.length > 1 ? "s" : ""}
                  </span>
                  <span className="font-heading font-bold text-foreground text-base tabular-nums">
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
                      <span className="tabular-nums text-sm text-muted-foreground">
                        +{movement.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  );
}
