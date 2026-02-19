"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Loader2, ImageIcon, ChevronDown, ChevronUp } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RecentMovement } from "@/lib/supabase/queries/dashboard";

import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useRecentMovements } from "@/hooks/queries";

const MOVEMENT_BADGE_STYLES: Record<string, string> = {
  entry:
    "border-green-400 bg-green-100 text-green-900 dark:border-green-700 dark:bg-green-900 dark:text-white",
  exit_technician:
    "border-blue-400 bg-blue-100 text-blue-900 dark:border-blue-700 dark:bg-blue-900 dark:text-white",
  exit_anonymous:
    "border-gray-400 bg-gray-100 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white",
  exit_loss:
    "border-red-400 bg-red-100 text-red-900 dark:border-red-700 dark:bg-red-900 dark:text-white",
};

interface MovementItemProps {
  movement: RecentMovement;
  compact?: boolean;
}

function MovementItem({ movement, compact }: MovementItemProps) {
  return (
    <div className={cn("flex items-center", compact ? "gap-3" : "")}>
      <figure className={cn(
        "bg-muted rounded-full border flex items-center justify-center shrink-0",
        compact ? "size-10 p-1.5" : "size-12 p-2"
      )}>
        {movement.product?.image_url ? (
          <Image
            className="size-full rounded-full object-cover"
            src={movement.product.image_url}
            width={compact ? 32 : 40}
            height={compact ? 32 : 40}
            alt={movement.product.name}
          />
        ) : (
          <ImageIcon className={cn("text-muted-foreground", compact ? "size-4" : "size-5")} />
        )}
      </figure>
      <div className={cn("space-y-0.5 flex-1 min-w-0", !compact && "ml-4 space-y-1")}>
        <p className={cn(
          "flex items-center gap-2 leading-none font-medium",
          compact ? "text-xs" : "text-sm"
        )}>
          <span className="truncate">{movement.product?.name}</span>
          <Badge
            className={cn(
              "border shrink-0",
              compact && "text-[10px] px-1.5 py-0",
              MOVEMENT_BADGE_STYLES[movement.movement_type]
            )}
          >
            {movement.movement_type === "entry" ? "Entrée" : "Sortie"}
          </Badge>
        </p>
        <p className={cn("text-muted-foreground", compact ? "text-[10px]" : "text-sm")}>
          {format(new Date(movement.created_at), compact ? "dd MMM, HH:mm" : "dd MMM yyyy, HH:mm", {
            locale: fr,
          })}
        </p>
      </div>
      <div className="ml-auto flex flex-col text-end shrink-0">
        <span
          className={cn(
            "font-semibold",
            compact ? "text-xs" : "",
            movement.movement_type === "entry"
              ? "text-green-600"
              : "text-red-600"
          )}
        >
          {movement.movement_type === "entry" ? "+" : "-"}
          {movement.quantity}
        </span>
        {!compact && movement.product?.price && (
          <span className="text-muted-foreground text-sm">
            {(movement.quantity * movement.product.price).toLocaleString(
              "fr-FR",
              { style: "currency", currency: "EUR" }
            )}
          </span>
        )}
      </div>
    </div>
  );
}

export function RecentActivities() {
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();
  const { data: movements = [], isLoading } = useRecentMovements(currentOrganization?.id, 6);
  const [isExpanded, setIsExpanded] = useState(false);

  if (isLoading || isOrgLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3 lg:pb-6">
          <CardTitle className="text-base lg:text-lg">Historique des flux</CardTitle>
        </CardHeader>
        <CardContent className="flex h-32 lg:h-64 items-center justify-center">
          <Loader2 className="size-6 lg:size-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Mobile: show only 3 items, collapsible
  const mobileMovements = movements.slice(0, 3);

  return (
    <Card className="h-full">
      {/* Mobile: Collapsible compact view */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="lg:hidden">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Activités récentes</CardTitle>
              {isExpanded ? (
                <ChevronUp className="size-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {movements.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-4">
                Aucun mouvement récent
              </p>
            ) : (
              mobileMovements.map((movement) => (
                <MovementItem key={movement.id} movement={movement} compact />
              ))
            )}
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href="/orders">Voir tout</Link>
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      {/* Desktop: Full view */}
      <div className="hidden lg:block">
        <CardHeader>
          <CardTitle>Historique des flux</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-6">
            {movements.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucun mouvement récent
              </p>
            ) : (
              movements.map((movement) => (
                <MovementItem key={movement.id} movement={movement} />
              ))
            )}
          </div>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/orders">Voir tout l'historique</Link>
          </Button>
        </CardContent>
      </div>
    </Card>
  );
}
