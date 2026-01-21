"use client";

import { useState } from "react";
import { PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import QuickStockMovementModal from "@/components/quick-stock-movement-modal";
import { BalanceSummeryChart } from "./components/chart-balance-summary";
import { SuccessMetrics } from "@/app/(protected)/global/components";
import { RecentActivities } from "./components/recent-activities";
import { QuickActions } from "./components/quick-actions";
import { CompactStats } from "./components/compact-stats";

export default function Page() {
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);

  return (
    <>
      <div className="mb-4 flex flex-row items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="text-muted-foreground hidden sm:block">
            Vue d'ensemble de votre gestion de stock
          </p>
        </div>
        <Button onClick={() => setIsRestockModalOpen(true)}>
          <PackagePlus className="size-4" />
          Restocker
        </Button>
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

      {/* Desktop Layout */}
      <div className="hidden lg:block space-y-4">
        {/* Top: Technicians (left) + Recent Activities (right) */}
        <div className="grid gap-4 lg:grid-cols-2">
          <SuccessMetrics />
          <RecentActivities />
        </div>

        {/* Bottom: Full width chart */}
        <BalanceSummeryChart />
      </div>

      {/* Restock Modal */}
      <QuickStockMovementModal
        open={isRestockModalOpen}
        onClose={() => setIsRestockModalOpen(false)}
        productId={null}
      />
    </>
  );
}
