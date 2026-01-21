"use client";

import { useEffect, useState } from "react";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { getTechniciansStats, TechniciansStats } from "@/lib/supabase/queries/technicians";

export default function TechnicianStats() {
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();
  const [stats, setStats] = useState<TechniciansStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      if (!currentOrganization) return;

      setIsLoading(true);
      try {
        const data = await getTechniciansStats(currentOrganization.id);
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
          <CardDescription>Total techniciens</CardDescription>
          <CardTitle className="font-display text-2xl lg:text-3xl">
            {stats.totalTechnicians}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">actifs</Badge>
          </CardAction>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Items en circulation</CardDescription>
          <CardTitle className="font-display text-2xl lg:text-3xl">
            {stats.totalItems.toLocaleString("fr-FR")}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">unités</Badge>
          </CardAction>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Inventaires vides</CardDescription>
          <CardTitle className="font-display text-2xl lg:text-3xl">
            {stats.emptyInventory}
          </CardTitle>
          <CardAction>
            {stats.emptyInventory > 0 ? (
              <Badge variant="warning">À restocker</Badge>
            ) : (
              <Badge variant="success">OK</Badge>
            )}
          </CardAction>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Restocks récents</CardDescription>
          <CardTitle className="font-display text-2xl lg:text-3xl">
            {stats.recentRestocks}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">7 derniers jours</Badge>
          </CardAction>
        </CardHeader>
      </Card>
    </div>
  );
}
