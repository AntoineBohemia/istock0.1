"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Loader2, Users } from "lucide-react";
import { getInitials } from "@/lib/utils";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getTechnicianStats,
  getTechniciansNeedingRestock,
  TechnicianNeedingRestock,
} from "@/lib/supabase/queries/dashboard";
import { useOrganizationStore } from "@/lib/stores/organization-store";

export function SuccessMetrics() {
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();
  const [stats, setStats] = useState({
    total: 0,
    withGoodStock: 0,
    withLowStock: 0,
    needingRestock: 0,
  });
  const [techniciansToRestock, setTechniciansToRestock] = useState<
    TechnicianNeedingRestock[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!currentOrganization) return;

      try {
        const [statsData, techniciansData] = await Promise.all([
          getTechnicianStats(currentOrganization.id),
          getTechniciansNeedingRestock(7, currentOrganization.id),
        ]);
        setStats(statsData);
        setTechniciansToRestock(techniciansData.slice(0, 6));
      } catch (error) {
        console.error("Error loading technician stats:", error);
      } finally {
        setIsLoading(false);
      }
    }

    if (!isOrgLoading && currentOrganization) {
      loadData();
    }
  }, [currentOrganization?.id, isOrgLoading]);

  if (isLoading || isOrgLoading) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardDescription>Nombre de techniciens actifs</CardDescription>
        <CardTitle className="font-display text-2xl lg:text-3xl">
          {stats.total}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-2 text-sm font-bold">Techniciens à restocker :</p>
        {techniciansToRestock.length > 0 ? (
          <div className="flex -space-x-4">
            <TooltipProvider>
              {techniciansToRestock.map((tech) => (
                <Tooltip key={tech.id}>
                  <TooltipTrigger asChild>
                    <Link href={`/users/${tech.id}`}>
                      <Avatar className="border-card size-12 border-4 hover:z-10 cursor-pointer">
                        <AvatarFallback>
                          {getInitials(`${tech.first_name} ${tech.last_name}`)}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center">
                      <p>
                        {tech.first_name} {tech.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tech.last_restock
                          ? `Dernier restock: ${tech.days_since_restock}j`
                          : "Jamais restocké"}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Tous les techniciens sont à jour
          </p>
        )}

        <p className="mt-8 mb-2 text-sm font-bold">Aperçu des techniciens</p>
        <div className="divide-y *:py-3">
          <div className="flex justify-between text-sm">
            <span>avec stock bon</span>
            <span className="flex items-center gap-1">
              <ArrowUpRight className="size-4 text-green-600" />
              {stats.withGoodStock}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span>avec stock faible</span>
            <span className="flex items-center gap-1">
              <ArrowDownLeft className="size-4 text-red-600" />
              {stats.withLowStock}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span>à restocker (&gt;7 jours)</span>
            <span className="flex items-center gap-1">
              <Users className="size-4 text-orange-500" />
              {stats.needingRestock}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
