"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

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

const chartData = [
  { date: "2024-04-01", desktop: 1050, mobile: 960 }, // Semaine 1
  { date: "2024-04-08", desktop: 1450, mobile: 1180 }, // Semaine 2
  { date: "2024-04-15", desktop: 1300, mobile: 1080 }, // Semaine 3
  { date: "2024-04-22", desktop: 1420, mobile: 1200 }, // Semaine 4
  { date: "2024-04-29", desktop: 1520, mobile: 1290 }, // Semaine 5
  { date: "2024-05-06", desktop: 1680, mobile: 1440 }, // Semaine 6
  { date: "2024-05-13", desktop: 1600, mobile: 1370 }, // Semaine 7
  { date: "2024-05-20", desktop: 1380, mobile: 1150 }, // Semaine 8
  { date: "2024-05-27", desktop: 1390, mobile: 1180 }, // Semaine 9
  { date: "2024-06-03", desktop: 1480, mobile: 1250 }, // Semaine 10
  { date: "2024-06-10", desktop: 1400, mobile: 1220 }, // Semaine 11
  { date: "2024-06-17", desktop: 1350, mobile: 1190 }, // Semaine 12
];

const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function RevenueChart() {
  const total = React.useMemo(
    () => chartData.reduce((acc, curr) => acc + curr.desktop, 0),
    []
  );

  return (
    <Card className="relative h-full overflow-hidden max-w-[400px]">
      <CardHeader>
        <CardTitle>Evolution du stock</CardTitle>
        <CardDescription>3 derniers mois</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[150px] w-full">
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 0,
              right: 0,
              bottom: 0,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
              }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[150px]"
                  nameKey="views"
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                  }}
                />
              }
            />
            <Bar dataKey="desktop" fill="var(--chart-2)" radius={5} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
