"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Layers, Warehouse, Loader2 } from "lucide-react";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useYearlyEntryValues } from "@/hooks/queries/use-stock-movements";
import { HeroNumber } from "@/components/ui/hero-number";

const formatCurrency = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export default function ProductStats() {
  const { isLoading: isOrgLoading } = useOrganizationStore();
  const organizations = useOrganizationStore((s) => s.organizations);
  const currentYear = new Date().getFullYear();
  const { data: yearlyData, isLoading } = useYearlyEntryValues(currentYear);

  if (isLoading || isOrgLoading || !yearlyData) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <CardDescription>Chargement...</CardDescription>
              <div className="flex items-center justify-center h-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  // Build per-org entries (show all orgs, even if value is 0)
  const orgEntries = organizations.map((org) => ({
    id: org.id,
    name: org.name,
    value: yearlyData.byOrg[org.id] ?? 0,
  }));

  // Dynamic grid columns based on card count
  const totalCards =
    orgEntries.length + (organizations.length > 1 ? 1 : 0) + 1;
  const gridCols =
    totalCards <= 3
      ? "md:grid-cols-3"
      : totalCards <= 4
        ? "md:grid-cols-2 lg:grid-cols-4"
        : "md:grid-cols-3 lg:grid-cols-5";

  return (
    <div className={`grid gap-4 ${gridCols}`}>
      {/* Per-org yearly entry value */}
      {orgEntries.map((org) => (
        <Card key={org.id}>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Building2 className="size-3.5" />
              Entrées {currentYear} — {org.name}
            </CardDescription>
            <CardTitle className="text-2xl lg:text-3xl">
              <HeroNumber value={org.value} format={formatCurrency} />
            </CardTitle>
          </CardHeader>
        </Card>
      ))}

      {/* Cumul all orgs (only if multi-org) */}
      {organizations.length > 1 && (
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Layers className="size-3.5" />
              Cumul entrées {currentYear}
            </CardDescription>
            <CardTitle className="text-2xl lg:text-3xl">
              <HeroNumber value={yearlyData.cumul} format={formatCurrency} />
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      {/* Global stock value */}
      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <Warehouse className="size-3.5" />
            Valeur du stock global
          </CardDescription>
          <CardTitle className="text-2xl lg:text-3xl">
            <HeroNumber value={yearlyData.globalStockValue} format={formatCurrency} />
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
