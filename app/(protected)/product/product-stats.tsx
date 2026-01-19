"use client";

import { useEffect, useState } from "react";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { getProductsStats } from "@/lib/supabase/queries/products";

interface Stats {
  total: number;
  lowStock: number;
  outOfStock: number;
  totalValue: number;
}

export default function ProductStats() {
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      if (!currentOrganization) return;

      setIsLoading(true);
      try {
        const data = await getProductsStats(currentOrganization.id);
        setStats(data);
      } catch (error) {
        console.error("Erreur lors du chargement des statistiques:", error);
      } finally {
        setIsLoading(false);
      }
    }

    if (!isOrgLoading && currentOrganization) {
      loadStats();
    }
  }, [currentOrganization?.id, isOrgLoading]);

  if (isLoading || isOrgLoading || !stats) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
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

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardDescription>Stock global</CardDescription>
          <CardTitle className="font-display text-2xl lg:text-3xl">
            {stats.total.toLocaleString("fr-FR")}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">unités</Badge>
          </CardAction>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Valeur totale du stock</CardDescription>
          <CardTitle className="font-display text-2xl lg:text-3xl">
            {stats.totalValue.toLocaleString("fr-FR", {
              style: "currency",
              currency: "EUR",
            })}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Stock faible</CardDescription>
          <CardTitle className="font-display text-2xl lg:text-3xl">
            {stats.lowStock}
          </CardTitle>
          <CardAction>
            {stats.lowStock > 0 ? (
              <Badge variant="warning">Attention</Badge>
            ) : (
              <Badge variant="success">OK</Badge>
            )}
          </CardAction>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Rupture de stock</CardDescription>
          <CardTitle className="font-display text-2xl lg:text-3xl">
            {stats.outOfStock}
          </CardTitle>
          <CardAction>
            {stats.outOfStock > 0 ? (
              <Badge variant="destructive">Critique</Badge>
            ) : (
              <Badge variant="success">OK</Badge>
            )}
          </CardAction>
        </CardHeader>
      </Card>
    </div>
  );
}
