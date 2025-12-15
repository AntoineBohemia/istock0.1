"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Loader2, ImageIcon } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getRecentMovements,
  RecentMovement,
} from "@/lib/supabase/queries/dashboard";
import { MOVEMENT_TYPE_LABELS } from "@/lib/supabase/queries/stock-movements";

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

export function RecentActivities() {
  const [movements, setMovements] = useState<RecentMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getRecentMovements(6);
        setMovements(data);
      } catch (error) {
        console.error("Error loading recent movements:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Historique des flux</CardTitle>
        </CardHeader>
        <CardContent className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
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
              <div className="flex items-center" key={movement.id}>
                <figure className="bg-muted size-12 rounded-full border p-2 flex items-center justify-center">
                  {movement.product?.image_url ? (
                    <Image
                      className="size-full rounded-full object-cover"
                      src={movement.product.image_url}
                      width={40}
                      height={40}
                      alt={movement.product.name}
                    />
                  ) : (
                    <ImageIcon className="size-5 text-muted-foreground" />
                  )}
                </figure>
                <div className="ml-4 space-y-1 flex-1 min-w-0">
                  <p className="flex items-center gap-2 text-sm leading-none font-medium">
                    <span className="truncate">{movement.product?.name}</span>
                    <Badge
                      className={cn(
                        "border shrink-0",
                        MOVEMENT_BADGE_STYLES[movement.movement_type]
                      )}
                    >
                      {movement.movement_type === "entry" ? "Entrée" : "Sortie"}
                    </Badge>
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {format(new Date(movement.created_at), "dd MMM yyyy, HH:mm", {
                      locale: fr,
                    })}
                  </p>
                </div>
                <div className="ml-auto flex flex-col text-end shrink-0">
                  <span
                    className={cn(
                      "font-semibold",
                      movement.movement_type === "entry"
                        ? "text-green-600"
                        : "text-red-600"
                    )}
                  >
                    {movement.movement_type === "entry" ? "+" : "-"}
                    {movement.quantity} Unités
                  </span>
                  {movement.product?.price && (
                    <span className="text-muted-foreground text-sm">
                      {(movement.quantity * movement.product.price).toLocaleString(
                        "fr-FR",
                        { style: "currency", currency: "EUR" }
                      )}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        <Button variant="outline" className="w-full" asChild>
          <Link href="/orders">Voir tout l'historique</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
