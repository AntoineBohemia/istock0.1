"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, Package, ImageIcon, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { getTechnician, TechnicianInventoryItem } from "@/lib/supabase/queries/technicians";
import { calculateInventoryPercentage } from "@/lib/supabase/queries/inventory";
import RestockDialog from "./restock-dialog";

interface TechnicianInventoryProps {
  technicianId: string;
}

export default function TechnicianInventory({
  technicianId,
}: TechnicianInventoryProps) {
  const [inventory, setInventory] = useState<TechnicianInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restockDialogOpen, setRestockDialogOpen] = useState(false);

  const loadInventory = async () => {
    setIsLoading(true);
    try {
      const technician = await getTechnician(technicianId);
      if (technician) {
        setInventory(technician.inventory);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors du chargement de l'inventaire"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [technicianId]);

  const handleRestockSuccess = () => {
    loadInventory();
  };

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
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Inventaire actuel</CardTitle>
            <CardDescription>
              {inventory.length === 0
                ? "Aucun produit dans l'inventaire"
                : `${inventory.length} produit(s) - ${inventory.reduce((sum, item) => sum + item.quantity, 0)} items au total`}
            </CardDescription>
          </div>
          <Button onClick={() => setRestockDialogOpen(true)}>
            <Plus className="size-4" />
            Restocker
          </Button>
        </CardHeader>
        <CardContent>
          {inventory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="size-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                L&apos;inventaire de ce technicien est vide.
              </p>
              <Button
                className="mt-4"
                onClick={() => setRestockDialogOpen(true)}
              >
                <Plus className="size-4" />
                Effectuer un restock
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>Quantité</TableHead>
                    <TableHead>Niveau</TableHead>
                    <TableHead>Assigné le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory.map((item) => {
                    const percentage = calculateInventoryPercentage(
                      item.quantity,
                      item.product?.stock_max || 100
                    );
                    const progressColor =
                      percentage < 30
                        ? "bg-red-500"
                        : percentage < 60
                          ? "bg-orange-500"
                          : "bg-green-500";

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <figure className="flex size-10 items-center justify-center rounded-lg border bg-muted">
                              {item.product?.image_url ? (
                                <Image
                                  src={item.product.image_url}
                                  width={40}
                                  height={40}
                                  alt={item.product.name}
                                  className="size-full rounded-lg object-cover"
                                />
                              ) : (
                                <ImageIcon className="size-5 text-muted-foreground" />
                              )}
                            </figure>
                            <div>
                              <p className="font-medium">
                                {item.product?.name || "Produit inconnu"}
                              </p>
                              {item.product?.sku && (
                                <p className="text-xs text-muted-foreground">
                                  {item.product.sku}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{item.quantity}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={percentage}
                              color={progressColor}
                              className="h-2 w-20"
                            />
                            <span className="text-sm text-muted-foreground">
                              {percentage}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(item.assigned_at).toLocaleDateString(
                            "fr-FR",
                            {
                              day: "numeric",
                              month: "short",
                            }
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <RestockDialog
        technicianId={technicianId}
        open={restockDialogOpen}
        onOpenChange={setRestockDialogOpen}
        onSuccess={handleRestockSuccess}
      />
    </>
  );
}
