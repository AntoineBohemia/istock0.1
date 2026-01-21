"use client";

import { useEffect, useState } from "react";
import { Package, Euro, ArrowDownToLine, ArrowUpFromLine, Loader2, AlertTriangle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { getDashboardStats, DashboardStats } from "@/lib/supabase/queries/dashboard";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  className?: string;
  iconClassName?: string;
}

function StatCard({ icon, label, value, subValue, className, iconClassName }: StatCardProps) {
  return (
    <div className={cn("flex items-center gap-3 rounded-lg border bg-card p-3", className)}>
      <div className={cn("rounded-lg p-2", iconClassName)}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
        {subValue && (
          <p className="text-xs text-muted-foreground">{subValue}</p>
        )}
      </div>
    </div>
  );
}

export function CompactStats() {
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!currentOrganization) return;

      try {
        const data = await getDashboardStats(currentOrganization.id);
        setStats(data);
      } catch (error) {
        console.error("Error loading stats:", error);
      } finally {
        setIsLoading(false);
      }
    }

    if (!isOrgLoading && currentOrganization) {
      loadData();
    }
  }, [currentOrganization?.id, isOrgLoading]);

  if (isLoading || isOrgLoading || !stats) {
    return (
      <Card>
        <CardContent className="flex h-32 items-center justify-center p-4">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <StatCard
        icon={<Package className="size-4" />}
        label="Stock total"
        value={stats.totalStock.toLocaleString("fr-FR")}
        subValue={`${stats.totalProducts} produits`}
        iconClassName="bg-primary/10 text-primary"
      />
      <StatCard
        icon={<Euro className="size-4" />}
        label="Valeur"
        value={stats.totalValue.toLocaleString("fr-FR", {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 0,
        })}
        iconClassName="bg-emerald-500/10 text-emerald-600"
      />
      <StatCard
        icon={<ArrowDownToLine className="size-4" />}
        label="Entrées (mois)"
        value={`+${stats.monthlyEntries}`}
        iconClassName="bg-green-500/10 text-green-600"
      />
      <StatCard
        icon={<ArrowUpFromLine className="size-4" />}
        label="Sorties (mois)"
        value={`-${stats.monthlyExits}`}
        subValue={stats.lowStockCount > 0 ? `${stats.lowStockCount} en alerte` : undefined}
        iconClassName="bg-red-500/10 text-red-600"
      />
    </div>
  );
}
