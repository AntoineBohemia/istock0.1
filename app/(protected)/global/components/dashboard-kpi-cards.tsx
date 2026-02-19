"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { computeTrend, type TrendResult } from "@/lib/utils/trends";
import type { HealthScoreKPI } from "@/lib/supabase/queries/dashboard";

interface DashboardKPICardsProps {
  kpi: HealthScoreKPI | undefined;
  isLoading: boolean;
}

interface KPICardData {
  label: string;
  value: string;
  trend: TrendResult | null;
  gradient: string;
  valueColor?: string;
  prefix?: string;
}

function TrendBadge({ trend }: { trend: TrendResult }) {
  if (trend.direction === "stable") {
    return (
      <Badge
        variant="outline"
        className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground"
      >
        <Minus className="mr-0.5 -ml-0.5 h-3.5 w-3.5 shrink-0" />
        0%
      </Badge>
    );
  }

  const isUp = trend.direction === "up";
  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 ps-2 text-xs font-medium",
        isUp
          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      )}
    >
      {isUp ? (
        <TrendingUp className="mr-0.5 -ml-1 h-4 w-4 shrink-0 text-green-500" />
      ) : (
        <TrendingDown className="mr-0.5 -ml-1 h-4 w-4 shrink-0 text-red-500" />
      )}
      {trend.percentage}%
    </Badge>
  );
}

export function DashboardKPICards({ kpi, isLoading }: DashboardKPICardsProps) {
  if (isLoading || !kpi) {
    return (
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-3 lg:p-4">
            <CardContent className="p-0 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Compute prev month stock from KPI data:
  // prev_stock = total_stock + exits_month - entries_month
  const prevMonthStock = kpi.total_stock + kpi.exits_month - kpi.entries_month;
  // Approximate prev value proportionally
  const prevMonthValue = kpi.total_stock > 0
    ? Math.round((prevMonthStock / kpi.total_stock) * kpi.total_value)
    : 0;

  const cards: KPICardData[] = [
    {
      label: "Stock actuel",
      value: kpi.total_stock.toLocaleString("fr-FR"),
      trend: computeTrend(kpi.total_stock, prevMonthStock),
      gradient: "from-background to-muted/30",
    },
    {
      label: "Valeur totale",
      value: kpi.total_value.toLocaleString("fr-FR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }),
      trend: computeTrend(kpi.total_value, prevMonthValue),
      gradient: "from-background to-muted/30",
    },
    {
      label: "Entrees (mois)",
      value: kpi.entries_month.toLocaleString("fr-FR"),
      prefix: "+",
      trend: computeTrend(kpi.entries_month, kpi.entries_prev_month),
      gradient: "from-background to-emerald-500/10",
      valueColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Sorties (mois)",
      value: kpi.exits_month.toLocaleString("fr-FR"),
      prefix: "-",
      trend: computeTrend(kpi.exits_month, kpi.exits_prev_month),
      gradient: "from-background to-rose-500/10",
      valueColor: "text-rose-600 dark:text-rose-400",
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={cn(
            "rounded-xl border bg-gradient-to-br p-3 lg:p-4 min-w-0",
            card.gradient
          )}
        >
          <div className="flex items-center justify-between gap-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap truncate">
              {card.label}
            </p>
            {card.trend && <TrendBadge trend={card.trend} />}
          </div>
          <p
            className={cn(
              "mt-1 text-xl lg:text-2xl font-bold tabular-nums whitespace-nowrap",
              card.valueColor
            )}
          >
            {card.prefix}{card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
