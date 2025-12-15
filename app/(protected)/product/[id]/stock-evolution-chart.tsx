"use client";

import { useEffect, useState } from "react";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { getProductMovementStats } from "@/lib/supabase/queries/stock-movements";

interface StockEvolutionChartProps {
  productId: string;
}

const chartConfig = {
  entries: {
    label: "Entrées",
    color: "hsl(var(--chart-2))",
  },
  exits: {
    label: "Sorties",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export default function StockEvolutionChart({
  productId,
}: StockEvolutionChartProps) {
  const [data, setData] = useState<
    Array<{
      date: string;
      entries: number;
      exits: number;
      balance: number;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const stats = await getProductMovementStats(productId, 3);
        setData(stats);
      } catch (error) {
        console.error("Error loading stock evolution:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [productId]);

  const totalEntries = data.reduce((sum, d) => sum + d.entries, 0);
  const totalExits = data.reduce((sum, d) => sum + d.exits, 0);
  const netBalance = totalEntries - totalExits;

  // Formater les données pour le graphique
  const chartData = data.map((d) => ({
    ...d,
    dateFormatted: format(new Date(d.date), "dd MMM", { locale: fr }),
  }));

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Evolution du stock</CardTitle>
          <CardDescription>Derniers 3 mois</CardDescription>
        </CardHeader>
        <CardContent className="flex h-48 items-center justify-center">
          <p className="text-muted-foreground">
            Aucun mouvement de stock enregistré
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolution du stock</CardTitle>
        <CardDescription>
          Entrées et sorties des 3 derniers mois
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="dateFormatted"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Area
              dataKey="entries"
              type="monotone"
              fill="var(--color-entries)"
              fillOpacity={0.4}
              stroke="var(--color-entries)"
              stackId="a"
            />
            <Area
              dataKey="exits"
              type="monotone"
              fill="var(--color-exits)"
              fillOpacity={0.4}
              stroke="var(--color-exits)"
              stackId="b"
            />
          </AreaChart>
        </ChartContainer>

        {/* Summary */}
        <div className="mt-4 grid grid-cols-3 gap-4 border-t pt-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Entrées</p>
            <p className="text-lg font-semibold text-green-600">
              +{totalEntries}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Sorties</p>
            <p className="text-lg font-semibold text-red-600">-{totalExits}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Balance</p>
            <p
              className={`flex items-center justify-center gap-1 text-lg font-semibold ${netBalance >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {netBalance >= 0 ? (
                <TrendingUp className="size-4" />
              ) : (
                <TrendingDown className="size-4" />
              )}
              {netBalance >= 0 ? "+" : ""}
              {netBalance}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
