"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Activity,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMovementsSummary } from "@/hooks/queries";
import { useOrganizationStore } from "@/lib/stores/organization-store";

export default function MovementsOverview() {
  const { currentOrganization } = useOrganizationStore();
  const orgId = currentOrganization?.id;
  const { data: summary = { totalEntries: 0, totalExits: 0, recentMovements: 0 } } = useMovementsSummary(orgId);

  const balance = summary.totalEntries - summary.totalExits;
  const isPositive = balance >= 0;

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Entrées (30 jours)
          </CardTitle>
          <ArrowDownToLine className="size-4 text-standard" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold font-heading tabular-nums text-standard">
            +{summary.totalEntries}
          </div>
          <p className="text-xs text-muted-foreground">
            unités entrées en stock
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Sorties (30 jours)
          </CardTitle>
          <ArrowUpFromLine className="size-4 text-critique" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold font-heading tabular-nums text-critique">
            -{summary.totalExits}
          </div>
          <p className="text-xs text-muted-foreground">
            unités sorties du stock
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Balance</CardTitle>
          {isPositive ? (
            <TrendingUp className="size-4 text-standard" />
          ) : (
            <TrendingDown className="size-4 text-critique" />
          )}
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold font-heading tabular-nums ${isPositive ? "text-standard" : "text-critique"}`}
          >
            {isPositive ? "+" : ""}
            {balance}
          </div>
          <p className="text-xs text-muted-foreground">
            variation nette du stock
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Mouvements récents
          </CardTitle>
          <Activity className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold font-heading tabular-nums">{summary.recentMovements}</div>
          <p className="text-xs text-muted-foreground">
            mouvements ce mois-ci
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
