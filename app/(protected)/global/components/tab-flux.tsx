"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Loader2, ImageIcon } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RecentMovement } from "@/lib/supabase/queries/dashboard";
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

const MOVEMENT_LABELS: Record<string, string> = {
  entry: "Entree",
  exit_technician: "Sortie tech.",
  exit_anonymous: "Sortie anon.",
  exit_loss: "Perte",
};

type FilterType = "all" | "entry" | "exit_technician" | "exit_anonymous" | "exit_loss";

function MovementItem({ movement }: { movement: RecentMovement }) {
  return (
    <div className="flex items-center gap-3">
      <figure className="bg-muted rounded-full border flex items-center justify-center shrink-0 size-10 p-1.5">
        {movement.product?.image_url ? (
          <Image
            className="size-full rounded-full object-cover"
            src={movement.product.image_url}
            width={32}
            height={32}
            alt={movement.product.name}
          />
        ) : (
          <ImageIcon className="size-4 text-muted-foreground" />
        )}
      </figure>
      <div className="space-y-0.5 flex-1 min-w-0">
        <p className="flex items-center gap-2 leading-none font-medium text-sm">
          <span className="truncate">{movement.product?.name}</span>
          <Badge className={cn("border shrink-0 text-[10px] px-1.5 py-0", MOVEMENT_BADGE_STYLES[movement.movement_type])}>
            {MOVEMENT_LABELS[movement.movement_type] || movement.movement_type}
          </Badge>
        </p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(movement.created_at ?? Date.now()), "dd MMM yyyy, HH:mm", { locale: fr })}
          {movement.technician && (
            <span className="ml-1">
              — {movement.technician.first_name} {movement.technician.last_name}
            </span>
          )}
        </p>
      </div>
      <div className="ml-auto flex flex-col text-end shrink-0">
        <span
          className={cn(
            "font-semibold text-sm",
            movement.movement_type === "entry" ? "text-green-600" : "text-red-600"
          )}
        >
          {movement.movement_type === "entry" ? "+" : "-"}
          {movement.quantity}
        </span>
        {movement.product?.price != null && movement.product.price > 0 && (
          <span className="text-muted-foreground text-xs">
            {(movement.quantity * movement.product.price).toLocaleString("fr-FR", {
              style: "currency",
              currency: "EUR",
            })}
          </span>
        )}
      </div>
    </div>
  );
}

export function TabFlux() {
  const { currentOrganization } = useOrganizationStore();
  const orgId = currentOrganization?.id;
  const { data: movements = [], isLoading } = useRecentMovements(orgId, 20);
  const [filter, setFilter] = useState<FilterType>("all");

  const filteredMovements = useMemo(() => {
    if (filter === "all") return movements;
    return movements.filter((m) => m.movement_type === filter);
  }, [movements, filter]);

  if (isLoading) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredMovements.length} mouvement{filteredMovements.length > 1 ? "s" : ""}
        </p>
        <Select value={filter} onValueChange={(val) => setFilter(val as FilterType)}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="entry">Entrees</SelectItem>
            <SelectItem value="exit_technician">Sorties tech.</SelectItem>
            <SelectItem value="exit_anonymous">Sorties anon.</SelectItem>
            <SelectItem value="exit_loss">Pertes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredMovements.length === 0 ? (
        <div className="flex h-[200px] items-center justify-center text-muted-foreground text-sm">
          Aucun mouvement
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMovements.map((movement) => (
            <MovementItem key={movement.id} movement={movement} />
          ))}
        </div>
      )}

      <Button variant="outline" className="w-full" asChild>
        <Link href="/orders">Voir tout l&apos;historique</Link>
      </Button>
    </div>
  );
}
