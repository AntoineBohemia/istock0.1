"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ChevronRight, History, ImageIcon } from "lucide-react";
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

/** « janvier », « décembre » — sert d'intertitre quand le mois change */
const monthKey = (d: Date) => d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

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
      {/* Recherche et total sur une seule ligne, comme ailleurs dans l'app */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Rechercher un produit..."
            className="bg-white dark:bg-card"
          />
        </div>
        <p className="text-sm text-muted-foreground tabular-nums shrink-0">
          {sessions.length} réappro{sessions.length > 1 ? "s" : ""} ·{" "}
          <span className="font-heading font-semibold text-foreground">{totalItems}</span> unités
          {search ? " (filtré)" : ` en ${year}`}
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="py-12 text-center text-muted-foreground text-sm">
            Aucun réapprovisionnement contenant &quot;{search}&quot;.
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          {sessions.map((session, sessionIndex) => {
            // Intertitre au changement de mois : sur une annee entiere, une
            // suite de dates sans reperes se lit mal.
            const showMonth =
              sessionIndex === 0 ||
              monthKey(session.date) !== monthKey(sessions[sessionIndex - 1].date);

            return (
              <div key={session.id}>
                {showMonth && (
                  <div className="bg-muted/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b">
                    {monthKey(session.date)}
                  </div>
                )}

                <Collapsible
                  className="group/collapsible border-b last:border-b-0"
                  defaultOpen={sessionIndex === 0 || !!search}
                >
                  <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer select-none text-left">
                    {/* Le chevron manquait : rien n'indiquait qu'une ligne s'ouvrait */}
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />

                    <span className="flex-1 min-w-0 font-medium text-sm">
                      {session.date.toLocaleDateString("fr-FR", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                      <span className="text-muted-foreground font-normal tabular-nums">
                        {" · "}
                        {session.date.toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </span>

                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {session.movements.length} produit
                      {session.movements.length > 1 ? "s" : ""}
                    </span>
                    <span className="font-heading font-bold text-foreground text-base tabular-nums shrink-0 w-12 text-right">
                      +{session.totalItems}
                    </span>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    {/* pl-11 = px-4 + taille du chevron + gap : les produits
                        s'alignent sous le libelle de la session, pas au hasard. */}
                    <div className="divide-y border-t bg-muted/20">
                      {session.movements.map((movement) => (
                        <div
                          key={movement.id}
                          className="flex items-center gap-3 pl-11 pr-4 py-2.5"
                        >
                          <figure className="flex size-8 items-center justify-center rounded-md border bg-card shrink-0 overflow-hidden">
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
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm leading-tight truncate">
                              {movement.product?.name || "Produit supprimé"}
                            </p>
                            {movement.product?.sku && (
                              <p className="text-[11px] text-muted-foreground font-mono">
                                {movement.product.sku}
                              </p>
                            )}
                          </div>
                          <span className="tabular-nums text-sm font-medium shrink-0 w-12 text-right">
                            +{movement.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
