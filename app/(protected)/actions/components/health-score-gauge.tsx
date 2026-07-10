"use client";

import { Label, PolarGrid, PolarRadiusAxis, RadialBar, RadialBarChart } from "recharts";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import type { HealthScore } from "@/lib/supabase/queries/dashboard";

interface HealthScoreGaugeProps {
  data: HealthScore | undefined;
  isLoading: boolean;
  compact?: boolean;
}

const ZONE_COLORS: Record<string, string> = {
  green: "hsl(142, 76%, 36%)",
  orange: "hsl(32, 95%, 44%)",
  red: "hsl(0, 84%, 60%)",
};

export function HealthScoreGauge({ data, isLoading, compact }: HealthScoreGaugeProps) {
  if (isLoading || !data) {
    return (
      <div className={`flex items-center justify-center ${compact ? "h-[80px] w-[80px]" : "h-[120px] w-[120px]"}`}>
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { score, label, color, penalties, trend } = data;
  const fillColor = ZONE_COLORS[color] || ZONE_COLORS.green;
  // endAngle: 0 score = 90 (start), 100 score = 90 - 360 = -270
  const endAngle = 90 - (score / 100) * 360;

  const chartData = [{ score, fill: fillColor }];

  const chartConfig = {
    score: { label: "Score" },
  } satisfies ChartConfig;

  const size = compact ? 80 : 120;
  const innerR = compact ? 28 : 42;
  const outerR = compact ? 23 : 35;
  const fontSize = compact ? "text-sm" : "text-lg";

  const gauge = (
    <div className="flex flex-col items-center gap-1">
      <ChartContainer config={chartConfig} className={`aspect-square`} style={{ height: size, width: size }}>
        <RadialBarChart
          data={chartData}
          startAngle={90}
          endAngle={endAngle}
          innerRadius={innerR}
          outerRadius={outerR}
        >
          <PolarGrid
            gridType="circle"
            radialLines={false}
            stroke="none"
            polarRadius={[innerR + 6, outerR - 6]}
          />
          <RadialBar dataKey="score" background cornerRadius={10} />
          <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
            <Label
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                  return (
                    <text
                      x={viewBox.cx}
                      y={viewBox.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy}
                        className={`fill-foreground font-bold ${fontSize}`}
                      >
                        {score}
                      </tspan>
                    </text>
                  );
                }
              }}
            />
          </PolarRadiusAxis>
        </RadialBarChart>
      </ChartContainer>
      {!compact && (
        <p className="text-xs text-muted-foreground text-center max-w-[120px] leading-tight">
          {label}
        </p>
      )}
    </div>
  );

  if (penalties.length === 0) return gauge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">{gauge}</div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="font-medium mb-1">Score de sante : {score}/100</p>
          <ul className="space-y-0.5 text-xs">
            {penalties.map((p, i) => (
              <li key={i} className="text-muted-foreground">
                -{p.points} pts : {p.details}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
