"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Area, AreaChart, Bar, BarChart } from "recharts";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardAction,
} from "@/components/ui/card";
import { ExportButton } from "@/components/CardActionMenus";
import {
  getDashboardStats,
  getGlobalStockEvolution,
  StockEvolutionData,
  DashboardStats,
} from "@/lib/supabase/queries/dashboard";

const colorStock = "hsl(var(--chart-1))";
const colorEntries = "hsl(var(--chart-2))";
const colorExits = "hsl(var(--chart-5))";

const chartConfig = {
  totalStock: {
    label: "Stock total",
    color: colorStock,
  },
  entries: {
    label: "Entrées",
    color: colorEntries,
  },
  exits: {
    label: "Sorties",
    color: colorExits,
  },
} satisfies ChartConfig;

export function BalanceSummeryChart() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<StockEvolutionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, evolutionData] = await Promise.all([
          getDashboardStats(),
          getGlobalStockEvolution(6),
        ]);
        setStats(statsData);
        setChartData(evolutionData);
      } catch (error) {
        console.error("Error loading chart data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Formatter les dates pour l'affichage
  const formattedChartData = chartData.map((d) => {
    const [year, month] = d.date.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return {
      ...d,
      monthLabel: format(date, "MMM yy", { locale: fr }),
    };
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Evolution du stock</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[400px] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Evolution du stock global</CardTitle>
        <CardAction className="relative">
          <div className="absolute end-0 top-0">
            <ExportButton />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="mb-8 grid gap-4 text-sm md:grid-cols-2 lg:max-w-(--breakpoint-sm) lg:grid-cols-4">
          <div className="bg-muted space-y-2 rounded-md border p-4">
            <div className="flex items-center gap-2">
              <span
                className="size-3 rounded-full"
                style={{ backgroundColor: colorStock }}
              ></span>
              <span>Stock actuel</span>
            </div>
            <div className="text-xl font-semibold">
              {stats?.totalStock.toLocaleString("fr-FR")}
            </div>
          </div>
          <div className="bg-muted space-y-2 rounded-md border p-4">
            <div className="flex items-center gap-2">
              <span
                className="size-3 rounded-full bg-blue-500"
              ></span>
              <span>Valeur totale</span>
            </div>
            <div className="text-xl font-semibold">
              {stats?.totalValue.toLocaleString("fr-FR", {
                style: "currency",
                currency: "EUR",
                maximumFractionDigits: 0,
              })}
            </div>
          </div>
          <div className="bg-muted space-y-2 rounded-md border p-4">
            <div className="flex items-center gap-2">
              <span
                className="size-3 rounded-full"
                style={{ backgroundColor: colorEntries }}
              ></span>
              <span>Entrées (mois)</span>
            </div>
            <div className="text-xl font-semibold text-green-600">
              +{stats?.monthlyEntries.toLocaleString("fr-FR")}
            </div>
          </div>
          <div className="bg-muted space-y-2 rounded-md border p-4">
            <div className="flex items-center gap-2">
              <span
                className="size-3 rounded-full"
                style={{ backgroundColor: colorExits }}
              ></span>
              <span>Sorties (mois)</span>
            </div>
            <div className="text-xl font-semibold text-red-600">
              -{stats?.monthlyExits.toLocaleString("fr-FR")}
            </div>
          </div>
        </div>

        {formattedChartData.length > 0 ? (
          <ChartContainer className="w-full lg:h-[300px]" config={chartConfig}>
            <AreaChart
              accessibilityLayer
              data={formattedChartData}
              margin={{
                left: 12,
                right: 12,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="monthLabel"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" />}
              />
              <Area
                dataKey="totalStock"
                type="monotone"
                fill={colorStock}
                fillOpacity={0.3}
                stroke={colorStock}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            Aucune donnée disponible
          </div>
        )}

        {/* Entrées/Sorties bar chart */}
        {formattedChartData.length > 0 && (
          <div className="mt-6">
            <p className="mb-4 text-sm font-medium">Flux mensuels</p>
            <ChartContainer className="w-full h-[150px]" config={chartConfig}>
              <BarChart
                accessibilityLayer
                data={formattedChartData}
                margin={{
                  left: 12,
                  right: 12,
                }}
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
                  content={<ChartTooltipContent />}
                />
                <Bar
                  dataKey="entries"
                  fill={colorEntries}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="exits"
                  fill={colorExits}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
