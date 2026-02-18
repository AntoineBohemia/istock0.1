"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronUp, Loader2, Users } from "lucide-react";
import { getInitials } from "@/lib/utils";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TechnicianNeedingRestock } from "@/lib/supabase/queries/dashboard";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useTechnicianStatsForDashboard, useTechniciansNeedingRestock } from "@/hooks/queries";

export function SuccessMetrics() {
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();
  const { data: stats = { total: 0, withGoodStock: 0, withLowStock: 0, needingRestock: 0 }, isLoading: isStatsLoading } = useTechnicianStatsForDashboard(currentOrganization?.id);
  const { data: techniciansData = [], isLoading: isTechLoading } = useTechniciansNeedingRestock(currentOrganization?.id, 7);
  const techniciansToRestock = techniciansData.slice(0, 6);
  const [isExpanded, setIsExpanded] = useState(false);
  const isLoading = isStatsLoading || isTechLoading;

  if (isLoading || isOrgLoading) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-32 lg:h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Don't show if no technicians
  if (stats.total === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardDescription>Techniciens</CardDescription>
          <CardTitle className="text-lg">Aucun technicien</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ajoutez des techniciens pour suivre leur inventaire.
          </p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link href="/users/create">Ajouter un technicien</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      {/* Mobile: Collapsible header */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="lg:hidden">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <CardDescription>Techniciens actifs</CardDescription>
                <CardTitle className="text-xl">
                  {stats.total}
                  {stats.needingRestock > 0 && (
                    <span className="ml-2 text-sm font-normal text-orange-500">
                      ({stats.needingRestock} à restocker)
                    </span>
                  )}
                </CardTitle>
              </div>
              {isExpanded ? (
                <ChevronUp className="size-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <TechnicianContent
              stats={stats}
              techniciansToRestock={techniciansToRestock}
            />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      {/* Desktop: Always visible */}
      <div className="hidden lg:block">
        <CardHeader>
          <CardDescription>Nombre de techniciens actifs</CardDescription>
          <CardTitle className="font-display text-2xl lg:text-3xl">
            {stats.total}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TechnicianContent
            stats={stats}
            techniciansToRestock={techniciansToRestock}
          />
        </CardContent>
      </div>
    </Card>
  );
}

interface TechnicianContentProps {
  stats: {
    total: number;
    withGoodStock: number;
    withLowStock: number;
    needingRestock: number;
  };
  techniciansToRestock: TechnicianNeedingRestock[];
}

function TechnicianContent({ stats, techniciansToRestock }: TechnicianContentProps) {
  return (
    <>
      <p className="mb-2 text-sm font-bold">Techniciens à restocker :</p>
      {techniciansToRestock.length > 0 ? (
        <div className="flex -space-x-4 overflow-x-auto pb-2">
          <TooltipProvider>
            {techniciansToRestock.map((tech) => (
              <Tooltip key={tech.id}>
                <TooltipTrigger asChild>
                  <Link href={`/users/${tech.id}`}>
                    <Avatar className="border-card size-10 lg:size-12 border-4 hover:z-10 cursor-pointer shrink-0">
                      <AvatarFallback className="text-xs lg:text-sm">
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

      <p className="mt-6 lg:mt-8 mb-2 text-sm font-bold">Aperçu des techniciens</p>
      <div className="divide-y *:py-2 lg:*:py-3">
        <div className="flex justify-between text-sm">
          <span>Stock en bonne état</span>
          <span className="flex items-center gap-1">
            <ArrowUpRight className="size-4 text-green-600" />
            {stats.withGoodStock}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Stock faible</span>
          <span className="flex items-center gap-1">
            <ArrowDownLeft className="size-4 text-red-600" />
            {stats.withLowStock}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span>A restocker (7 jours)</span>
          <span className="flex items-center gap-1">
            <Users className="size-4 text-orange-500" />
            {stats.needingRestock}
          </span>
        </div>
      </div>
    </>
  );
}
