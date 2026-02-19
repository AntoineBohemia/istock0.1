"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  XAxis,
  YAxis,
  Area,
  AreaChart,
  ReferenceArea,
  Bar,
  BarChart,
} from "recharts";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import {
  useHealthScore,
  useHealthScoreHistory,
  useGlobalStockEvolution,
} from "@/hooks/queries";

// ─── Score label helper (mirrors SQL logic) ───────────────────────────
function getScoreLabel(score: number): string {
  if (score >= 90) return "Sous controle";
  if (score >= 70) return "Quelques points d'attention";
  if (score >= 40) return "Situation degradee";
  return "Action urgente requise";
}

// ─── Zone colors for the background bands ─────────────────────────────
const ZONE_RED    = "hsl(0 84% 60% / 0.08)";
const ZONE_ORANGE = "hsl(32 95% 44% / 0.08)";
const ZONE_GREEN  = "hsl(142 76% 36% / 0.08)";

// ─── Chart configs ────────────────────────────────────────────────────
const scoreChartConfig = {
  score: { label: "Score", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const flowChartConfig = {
  entries: { label: "Entrees", color: "hsl(160 84% 39%)" },
  exits: { label: "Sorties", color: "hsl(350 89% 60%)" },
} satisfies ChartConfig;

// ─── Custom tooltip for score chart ───────────────────────────────────
function ScoreTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.[0]) return null;
  const score = payload[0].value as number;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">
        {score}/100 — {getScoreLabel(score)}
      </p>
    </div>
  );
}

export function TabApercu() {
  const { currentOrganization } = useOrganizationStore();
  const orgId = currentOrganization?.id;

  const { data: healthScore, isLoading: isScoreLoading } = useHealthScore(orgId);
  const { data: historyRaw = [], isLoading: isHistoryLoading } = useHealthScoreHistory(orgId, 6);
  const { data: globalChartData = [], isLoading: isEvolutionLoading } = useGlobalStockEvolution(orgId, 6);

  const isLoading = isScoreLoading || isHistoryLoading || isEvolutionLoading;

  // Build chart data: history months + current month from live score
  const scoreChartData = useMemo(() => {
    const data = historyRaw.map((m) => {
      const [year, month] = m.month.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return {
        month: m.month,
        monthLabel: format(date, "MMM yy", { locale: fr }),
        score: m.score,
      };
    });

    // Append current month from live health score
    if (healthScore) {
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      // Only add if not already present in history
      if (!data.some((d) => d.month === currentMonthKey)) {
        data.push({
          month: currentMonthKey,
          monthLabel: format(now, "MMM yy", { locale: fr }),
          score: healthScore.score,
        });
      }
    }

    return data;
  }, [historyRaw, healthScore]);

  // Flow bar chart data
  const flowChartData = useMemo(() => {
    return globalChartData.map((d) => {
      const [year, month] = d.date.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return {
        ...d,
        monthLabel: format(date, "MMM yy", { locale: fr }),
      };
    });
  }, [globalChartData]);

  if (isLoading) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentScore = healthScore?.score;
  const currentLabel = healthScore?.label;
  const scoreColor =
    currentScore != null
      ? currentScore >= 70
        ? "text-green-600 dark:text-green-400"
        : currentScore >= 40
          ? "text-orange-600 dark:text-orange-400"
          : "text-red-600 dark:text-red-400"
      : "";

  return (
    <div className="space-y-6">
      {/* Score header */}
      {currentScore != null && (
        <div className="flex items-baseline gap-3">
          <span className={`text-3xl font-bold tabular-nums ${scoreColor}`}>
            {currentScore}
          </span>
          <span className="text-sm text-muted-foreground">/100</span>
          <span className="text-sm text-muted-foreground">—</span>
          <span className="text-sm font-medium">{currentLabel}</span>
        </div>
      )}

      {/* Score Evolution Area Chart with colored bands */}
      {scoreChartData.length > 0 ? (
        <ChartContainer className="h-[200px] lg:h-[250px] w-full" config={scoreChartConfig}>
          <AreaChart
            accessibilityLayer
            data={scoreChartData}
            margin={{ left: 12, right: 12, top: 5, bottom: 5 }}
          >
            <defs>
              <linearGradient id="fillScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1} />
              </linearGradient>
            </defs>

            {/* Background bands: green (70-100), orange (40-69), red (0-39) */}
            <ReferenceArea y1={70} y2={100} fill={ZONE_GREEN} fillOpacity={1} />
            <ReferenceArea y1={40} y2={70} fill={ZONE_ORANGE} fillOpacity={1} />
            <ReferenceArea y1={0} y2={40} fill={ZONE_RED} fillOpacity={1} />

            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="monthLabel"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              ticks={[0, 40, 70, 100]}
            />
            <ChartTooltip content={<ScoreTooltipContent />} />
            <Area
              dataKey="score"
              type="monotone"
              fill="url(#fillScore)"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      ) : (
        <div className="flex h-[200px] items-center justify-center text-muted-foreground">
          Historique en cours de construction
        </div>
      )}

      {/* Entries/Exits Bar Chart */}
      {flowChartData.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-3">Flux mensuels</p>
          <ChartContainer className="h-[120px] lg:h-[150px] w-full" config={flowChartConfig}>
            <BarChart
              accessibilityLayer
              data={flowChartData}
              margin={{ left: 12, right: 12 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="monthLabel"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <ChartTooltip
                cursor={false}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
                      <p className="text-xs text-muted-foreground mb-1">{label}</p>
                      {payload.map((p: any) => (
                        <p key={p.dataKey} className="text-sm">
                          <span
                            className="inline-block size-2 rounded-full mr-1.5"
                            style={{ backgroundColor: p.color }}
                          />
                          {p.name}: {p.value?.toLocaleString("fr-FR")}
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              <Bar dataKey="entries" fill="hsl(160 84% 39%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="exits" fill="hsl(350 89% 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </div>
  );
}
