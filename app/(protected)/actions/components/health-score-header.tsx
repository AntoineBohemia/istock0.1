"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { computeTrend, type TrendResult } from "@/lib/utils/trends";
import { useHealthScore } from "@/hooks/queries";
import type { HealthScore, HealthScoreKPI } from "@/lib/supabase/queries/dashboard";

// ─── Zone color mapping ─────────────────────────────────────────────
const SCORE_COLORS: Record<string, { text: string; progress: string; bg: string }> = {
  green: {
    text: "text-standard",
    progress: "bg-standard",
    bg: "bg-standard-bg",
  },
  orange: {
    text: "text-attention",
    progress: "bg-attention",
    bg: "bg-attention-bg",
  },
  red: {
    text: "text-critique",
    progress: "bg-critique",
    bg: "bg-critique-bg",
  },
};

// ─── Score Panel (left side) ────────────────────────────────────────
function ScorePanel({ data }: { data: HealthScore }) {
  const { score, label, color, penalties, trend } = data;
  const colors = SCORE_COLORS[color] || SCORE_COLORS.green;

  const scoreDelta =
    trend.previous_score != null ? score - trend.previous_score : null;

  const topPenalties = [...penalties]
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className={cn("text-4xl font-bold font-heading tabular-nums", colors.text)}>
          {score}
        </span>
        <span className="text-lg text-muted-foreground">/100</span>
        {scoreDelta != null && scoreDelta !== 0 && (
          <span
            className={cn(
              "ml-2 inline-flex items-center gap-0.5 text-sm font-medium font-heading tabular-nums",
              scoreDelta > 0 ? "text-standard" : "text-critique"
            )}
          >
            {scoreDelta > 0 ? (
              <ArrowUpIcon className="size-3.5" />
            ) : (
              <ArrowDownIcon className="size-3.5" />
            )}
            {Math.abs(scoreDelta)} pts
          </span>
        )}
      </div>

      <Progress
        value={score}
        className="h-2.5"
        indicatorColor={colors.progress}
      />

      <p className="text-sm font-medium">{label}</p>

      {topPenalties.length > 0 && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {topPenalties.map((p) => p.details).join(" · ")}
        </p>
      )}
    </div>
  );
}

// ─── Score Panel compact (mobile) ───────────────────────────────────
function ScorePanelCompact({ data }: { data: HealthScore }) {
  const { score, label, color, trend } = data;
  const colors = SCORE_COLORS[color] || SCORE_COLORS.green;
  const scoreDelta =
    trend.previous_score != null ? score - trend.previous_score : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className={cn("text-3xl font-bold font-heading tabular-nums", colors.text)}>
            {score}
          </span>
          <span className="text-sm text-muted-foreground">/100</span>
          {scoreDelta != null && scoreDelta !== 0 && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium font-heading tabular-nums",
                scoreDelta > 0 ? "text-standard" : "text-critique"
              )}
            >
              {scoreDelta > 0 ? (
                <ArrowUpIcon className="size-3" />
              ) : (
                <ArrowDownIcon className="size-3" />
              )}
              {Math.abs(scoreDelta)}
            </span>
          )}
        </div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <Progress
        value={score}
        className="h-2"
        indicatorColor={colors.progress}
      />
    </div>
  );
}

// ─── Trend Badge (reused from stat-cards pattern) ───────────────────
function TrendBadge({ trend }: { trend: TrendResult }) {
  if (trend.direction === "stable") {
    return (
      <Badge
        variant="outline"
        className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground"
      >
        <Minus className="mr-0.5 -ml-0.5 size-3 shrink-0" />
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
          ? "bg-standard-bg text-standard"
          : "bg-critique-bg text-critique"
      )}
    >
      {isUp ? (
        <TrendingUp className="mr-0.5 -ml-1 size-3.5 shrink-0 text-standard" />
      ) : (
        <TrendingDown className="mr-0.5 -ml-1 size-3.5 shrink-0 text-critique" />
      )}
      {trend.percentage}%
    </Badge>
  );
}

// ─── KPI Cards ──────────────────────────────────────────────────────
interface KPICardData {
  label: string;
  value: string;
  trend: TrendResult;
  prefix?: string;
  valueColor?: string;
}

function KPICards({ kpi }: { kpi: HealthScoreKPI }) {
  const prevMonthStock = kpi.total_stock + kpi.exits_month - kpi.entries_month;
  const prevMonthValue =
    kpi.total_stock > 0
      ? Math.round((prevMonthStock / kpi.total_stock) * kpi.total_value)
      : 0;

  const cards: KPICardData[] = [
    {
      label: "Stock actuel",
      value: kpi.total_stock.toLocaleString("fr-FR"),
      trend: computeTrend(kpi.total_stock, prevMonthStock),
    },
    {
      label: "Valeur totale",
      value: kpi.total_value.toLocaleString("fr-FR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }),
      trend: computeTrend(kpi.total_value, prevMonthValue),
    },
    {
      label: "Entrees",
      value: kpi.entries_month.toLocaleString("fr-FR"),
      prefix: "+",
      trend: computeTrend(kpi.entries_month, kpi.entries_prev_month),
      valueColor: "text-standard",
    },
    {
      label: "Sorties",
      value: kpi.exits_month.toLocaleString("fr-FR"),
      prefix: "-",
      trend: computeTrend(kpi.exits_month, kpi.exits_prev_month),
      valueColor: "text-critique",
    },
  ];

  return (
    <div className="grid gap-2.5 grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border p-3 min-w-0"
        >
          <div className="flex items-center justify-between gap-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground truncate">
              {card.label}
            </p>
            <TrendBadge trend={card.trend} />
          </div>
          <p
            className={cn(
              "mt-1 text-lg font-semibold font-heading tabular-nums whitespace-nowrap",
              card.valueColor
            )}
          >
            {card.prefix}
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Loading skeleton ───────────────────────────────────────────────
function HeaderSkeleton() {
  return (
    <Card className="p-4 lg:p-5">
      <CardContent className="p-0">
        <div className="hidden lg:flex lg:gap-8">
          <div className="w-64 space-y-3">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-2.5 w-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <div className="flex-1 grid gap-2.5 grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        </div>
        <div className="lg:hidden space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-2 w-full" />
          <div className="grid gap-2.5 grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main component ─────────────────────────────────────────────────
interface HealthScoreHeaderProps {
  orgId?: string;
}

export function HealthScoreHeader({ orgId }: HealthScoreHeaderProps) {
  const { data, isLoading } = useHealthScore(orgId);

  if (isLoading || !data) {
    return <HeaderSkeleton />;
  }

  return (
    <Card className="p-4 lg:p-5">
      <CardContent className="p-0">
        <div className="hidden lg:flex lg:items-start lg:gap-8">
          <div className="w-64 shrink-0">
            <ScorePanel data={data} />
          </div>
          <div className="flex-1 min-w-0">
            <KPICards kpi={data.kpi} />
          </div>
        </div>

        <div className="lg:hidden space-y-3">
          <ScorePanelCompact data={data} />
          <KPICards kpi={data.kpi} />
        </div>
      </CardContent>
    </Card>
  );
}
