"use client";

import { HealthScoreGauge } from "./health-score-gauge";
import { DashboardKPICards } from "./dashboard-kpi-cards";
import { useHealthScore } from "@/hooks/queries";

interface DashboardHeaderProps {
  orgId?: string;
}

export function DashboardHeader({ orgId }: DashboardHeaderProps) {
  const { data: healthScore, isLoading } = useHealthScore(orgId);

  return (
    <div className="space-y-3 lg:space-y-0">
      {/* Mobile: gauge on top, KPIs below */}
      <div className="flex items-center gap-4 lg:hidden">
        <HealthScoreGauge data={healthScore} isLoading={isLoading} compact />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {healthScore?.label || "Chargement..."}
          </p>
          <p className="text-xs text-muted-foreground">
            Score : {healthScore?.score ?? "..."}/100
          </p>
        </div>
      </div>

      {/* Mobile KPIs */}
      <div className="lg:hidden">
        <DashboardKPICards kpi={healthScore?.kpi} isLoading={isLoading} />
      </div>

      {/* Desktop: gauge left + KPIs right */}
      <div className="hidden lg:flex lg:items-center lg:gap-6">
        <div className="shrink-0">
          <HealthScoreGauge data={healthScore} isLoading={isLoading} />
        </div>
        <div className="flex-1 min-w-0">
          <DashboardKPICards kpi={healthScore?.kpi} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
