"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useYearlyEntryValues } from "@/hooks/queries/use-stock-movements";
import { HeroNumber } from "@/components/ui/hero-number";
import { useAchatsYear } from "./achats-year-context";
import CategoryBreakdownModal from "./category-breakdown-modal";

const formatCurrency = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

interface OpenCard {
  title: string;
  organizationId: string | null;
  mode: "purchases" | "stock";
}

export default function AchatsStats() {
  const { isLoading: isOrgLoading } = useOrganizationStore();
  const organizations = useOrganizationStore((s) => s.organizations);
  const { year } = useAchatsYear();
  const { data: yearlyData, isLoading } = useYearlyEntryValues(year);
  const [openCard, setOpenCard] = useState<OpenCard | null>(null);

  if (isLoading || isOrgLoading || !yearlyData) {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-xl" />
        ))}
      </div>
    );
  }

  const cards: Array<OpenCard & { value: number; hint: string }> = [
    ...organizations.map((org) => ({
      title: `Achats ${year} — ${org.name}`,
      hint: org.name,
      organizationId: org.id,
      mode: "purchases" as const,
      value: yearlyData.byOrg[org.id] ?? 0,
    })),
    ...(organizations.length > 1
      ? [
          {
            title: `Achats ${year} — toutes sociétés`,
            hint: `Cumul ${year}`,
            organizationId: null,
            mode: "purchases" as const,
            value: yearlyData.cumul,
          },
        ]
      : []),
    {
      title: "Valeur du stock",
      // Perimetre annonce explicitement : l'outillage n'y figure pas, comme
      // dans l'export « etat de stock ». Les deux ecrans donnaient auparavant
      // deux montants differents pour la meme notion.
      hint: "Valeur du stock · consommables",
      organizationId: null,
      mode: "stock" as const,
      value: yearlyData.globalStockValue,
    },
  ];

  const gridCols =
    cards.length <= 3
      ? "md:grid-cols-3"
      : cards.length === 4
        ? "md:grid-cols-2 lg:grid-cols-4"
        : "md:grid-cols-3 lg:grid-cols-5";

  return (
    <>
      <div className={`grid gap-3 ${gridCols}`}>
        {cards.map((card) => (
          <button
            key={card.title}
            type="button"
            onClick={() => setOpenCard(card)}
            className="group rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/40 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">{card.hint}</p>
              {/* La fleche signale qu'un detail existe derriere le chiffre */}
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
            </div>
            <p className="font-heading text-2xl font-bold tabular-nums mt-2 leading-none">
              <HeroNumber value={card.value} format={formatCurrency} />
            </p>
          </button>
        ))}
      </div>

      {openCard && (
        <CategoryBreakdownModal
          open
          onOpenChange={(o) => !o && setOpenCard(null)}
          title={openCard.title}
          year={year}
          organizationId={openCard.organizationId}
          mode={openCard.mode}
        />
      )}
    </>
  );
}
