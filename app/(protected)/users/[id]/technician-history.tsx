"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, History, Package, ImageIcon } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getTechnicianStockMovements,
  TechnicianStockMovement,
} from "@/lib/supabase/queries/technicians";

interface TechnicianHistoryProps {
  technicianId: string;
}

export default function TechnicianHistory({
  technicianId,
}: TechnicianHistoryProps) {
  const [movements, setMovements] = useState<TechnicianStockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMovements();
  }, [technicianId]);

  const loadMovements = async () => {
    setIsLoading(true);
    try {
      const data = await getTechnicianStockMovements(technicianId);
      setMovements(data);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors du chargement de l'historique"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Group movements by date
  const groupedMovements = movements.reduce(
    (groups, movement) => {
      const date = new Date(movement.created_at).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(movement);
      return groups;
    },
    {} as Record<string, TechnicianStockMovement[]>
  );

  const totalItems = movements.reduce((sum, m) => sum + m.quantity, 0);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique des approvisionnements</CardTitle>
        <CardDescription>
          {movements.length === 0
            ? "Aucun approvisionnement effectué"
            : `${movements.length} mouvement(s) - ${totalItems} item(s) au total`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {movements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <History className="size-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">
              Aucun historique d&apos;approvisionnement disponible.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Les mouvements apparaîtront ici lorsque des produits seront
              envoyés à ce technicien.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedMovements).map(([date, dateMovements]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <Package className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{date}</p>
                    <p className="text-xs text-muted-foreground">
                      {dateMovements.reduce((sum, m) => sum + m.quantity, 0)}{" "}
                      item(s)
                    </p>
                  </div>
                </div>
                <div className="rounded-md border ml-10">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Heure</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="text-right">Quantité</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dateMovements.map((movement) => (
                        <TableRow key={movement.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <figure className="flex size-8 items-center justify-center rounded border bg-muted">
                                {movement.product?.image_url ? (
                                  <Image
                                    src={movement.product.image_url}
                                    width={32}
                                    height={32}
                                    alt={movement.product.name}
                                    className="size-full rounded object-cover"
                                  />
                                ) : (
                                  <ImageIcon className="size-4 text-muted-foreground" />
                                )}
                              </figure>
                              <span className="font-medium">
                                {movement.product?.name || "Produit supprimé"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground font-mono text-xs">
                            {movement.product?.sku || "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(movement.created_at).toLocaleTimeString(
                              "fr-FR",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                            {movement.notes || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">+{movement.quantity}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
