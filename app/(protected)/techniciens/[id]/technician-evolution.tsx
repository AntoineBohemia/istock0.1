"use client";

import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  format,
  startOfWeek,
  startOfMonth,
  eachWeekOfInterval,
  eachMonthOfInterval,
  subMonths,
} from "date-fns";
import { fr } from "date-fns/locale";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useTechnicianEvolution } from "@/hooks/queries";
import type { TechnicianEvolutionMovement } from "@/lib/supabase/queries/technicians";

interface TechnicianEvolutionProps {
  technicianId: string;
}

type Granularity = "week" | "month";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function buildChartData(
  movements: TechnicianEvolutionMovement[],
  months: number,
  granularity: Granularity
) {
  const now = new Date();
  const start = subMonths(now, months);

  // Get unique products
  const productMap = new Map<string, string>();
  for (const m of movements) {
    if (m.product && !productMap.has(m.product_id)) {
      productMap.set(m.product_id, m.product.name);
    }
  }
  const products = Array.from(productMap.entries()); // [id, name][]

  // Build period buckets
  const periods =
    granularity === "week"
      ? eachWeekOfInterval({ start, end: now }, { weekStartsOn: 1 })
      : eachMonthOfInterval({ start, end: now });

  const chartData = periods.map((periodStart) => {
    const label =
      granularity === "week"
        ? format(periodStart, "'S'w", { locale: fr })
        : format(periodStart, "MMM yy", { locale: fr });

    const row: Record<string, string | number> = { period: label };

    for (const [productId, productName] of products) {
      const qty = movements
        .filter((m) => {
          const mDate = new Date(m.created_at);
          const mPeriod =
            granularity === "week" ? startOfWeek(mDate, { weekStartsOn: 1 }) : startOfMonth(mDate);
          return m.product_id === productId && mPeriod.getTime() === periodStart.getTime();
        })
        .reduce((sum, m) => sum + m.quantity, 0);
      row[productName] = qty;
    }

    return row;
  });

  return { chartData, products };
}

function buildSummaryData(
  movements: TechnicianEvolutionMovement[],
  months: number,
  granularity: Granularity
) {
  const now = new Date();
  const start = subMonths(now, months);

  const periods =
    granularity === "week"
      ? eachWeekOfInterval({ start, end: now }, { weekStartsOn: 1 })
      : eachMonthOfInterval({ start, end: now });
  const totalPeriods = periods.length;

  // Group by product
  const byProduct = new Map<
    string,
    { name: string; sku: string | null; total: number; activePeriods: Set<number> }
  >();

  for (const m of movements) {
    if (!m.product) continue;
    let entry = byProduct.get(m.product_id);
    if (!entry) {
      entry = { name: m.product.name, sku: m.product.sku, total: 0, activePeriods: new Set() };
      byProduct.set(m.product_id, entry);
    }
    entry.total += m.quantity;

    const mDate = new Date(m.created_at);
    const mPeriod =
      granularity === "week" ? startOfWeek(mDate, { weekStartsOn: 1 }) : startOfMonth(mDate);
    const periodIndex = periods.findIndex((p) => p.getTime() === mPeriod.getTime());
    if (periodIndex >= 0) entry.activePeriods.add(periodIndex);
  }

  return Array.from(byProduct.values())
    .sort((a, b) => b.total - a.total)
    .map((entry) => ({
      name: entry.name,
      sku: entry.sku,
      total: entry.total,
      activePeriods: entry.activePeriods.size,
      totalPeriods,
      average:
        entry.activePeriods.size > 0
          ? Math.round((entry.total / entry.activePeriods.size) * 10) / 10
          : 0,
    }));
}

export default function TechnicianEvolution({ technicianId }: TechnicianEvolutionProps) {
  const [months, setMonths] = useState(3);
  const [granularity, setGranularity] = useState<Granularity>("week");

  const { data: movements = [], isLoading } = useTechnicianEvolution(technicianId, months);

  const { chartData, products } = useMemo(
    () => buildChartData(movements, months, granularity),
    [movements, months, granularity]
  );

  const summaryData = useMemo(
    () => buildSummaryData(movements, months, granularity),
    [movements, months, granularity]
  );

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    products.forEach(([, name], i) => {
      config[name] = {
        label: name,
        color: CHART_COLORS[i % CHART_COLORS.length],
      };
    });
    return config;
  }, [products]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Chart skeleton */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-[120px] rounded-md" />
                <Skeleton className="h-9 w-[120px] rounded-md" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-[200px]">
              {[45, 72, 38, 85, 55, 65, 42, 78].map((h, i) => (
                <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: `${h}%` }} />
              ))}
            </div>
          </CardContent>
        </Card>
        {/* Summary table skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Evolution des attributions</CardTitle>
              <CardDescription>
                Quantités attribuées par {granularity === "week" ? "semaine" : "mois"} sur les{" "}
                {months} dernier{months > 1 ? "s" : ""} mois
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 mois</SelectItem>
                  <SelectItem value="3">3 mois</SelectItem>
                  <SelectItem value="6">6 mois</SelectItem>
                </SelectContent>
              </Select>
              <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Semaine</SelectItem>
                  <SelectItem value="month">Mois</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <TrendingUp className="size-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">Aucun mouvement sur cette période.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Les attributions apparaîtront ici lorsque des produits seront envoyés à ce
                technicien.
              </p>
            </div>
          ) : (
            <ChartContainer config={chartConfig}>
              <BarChart accessibilityLayer data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="period" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} />
                {products.map(([, name], i) => (
                  <Bar
                    key={name}
                    dataKey={name}
                    stackId="a"
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                  />
                ))}
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {summaryData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Récapitulatif</CardTitle>
            <CardDescription>Détail par produit sur la période sélectionnée</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>Total attribué</TableHead>
                  <TableHead>{granularity === "week" ? "Semaines" : "Mois"} actives</TableHead>
                  <TableHead>Moy. / {granularity === "week" ? "semaine" : "mois"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryData.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{row.name}</p>
                        {row.sku && (
                          <p className="text-xs text-muted-foreground font-mono">{row.sku}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{row.total}</TableCell>
                    <TableCell>
                      {row.activePeriods} / {row.totalPeriods}
                    </TableCell>
                    <TableCell>{row.average}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
