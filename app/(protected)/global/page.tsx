import { generateMeta } from "@/lib/utils";

import { BalanceSummeryChart } from "./components/chart-balance-summary";
import { SuccessMetrics } from "@/app/(protected)/global/components";
import { RecentActivities } from "./components/recent-activities";
import { StockMovementCard } from "./components/trading-card";
import { QuickActions } from "./components/quick-actions";
import { CompactStats } from "./components/compact-stats";

export async function generateMetadata() {
  return generateMeta({
    title: "Tableau de bord",
    description:
      "Vue d'ensemble de votre stock, mouvements récents et techniciens à restocker.",
    canonical: "/global",
  });
}

export default function Page() {
  return (
    <>
      <div className="mb-4 flex flex-row items-center justify-between space-y-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="text-muted-foreground hidden sm:block">
            Vue d'ensemble de votre gestion de stock
          </p>
        </div>
      </div>

      {/* Mobile Layout: Compact and efficient */}
      <div className="lg:hidden space-y-3">
        {/* Quick Actions - Most important on mobile */}
        <QuickActions />

        {/* Compact Stats Grid */}
        <CompactStats />

        {/* Recent Activities - Important for quick view */}
        <RecentActivities />

        {/* Technicians - Collapsible */}
        <SuccessMetrics />

        {/* Chart - Last on mobile, less critical */}
        <BalanceSummeryChart />
      </div>

      {/* Desktop Layout: Original grid system */}
      <div className="hidden lg:block">
        <div className="mt-4 grid gap-4 xl:grid-cols-4 2xl:grid-cols-4">
          <div className="xl:col-span-1 2xl:col-span-1">
            <StockMovementCard />
          </div>
          <div className="xl:col-span-3 2xl:col-span-3">
            <SuccessMetrics />
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <BalanceSummeryChart />
          </div>
          <RecentActivities />
        </div>
      </div>
    </>
  );
}
