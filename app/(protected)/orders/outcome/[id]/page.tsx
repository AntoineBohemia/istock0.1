import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Upload01,
  Package,
  User01,
  UserX01,
  Trash01,
  AlertTriangle,
  Image01,
} from "@untitled-ui/icons-react";
import { generateMeta } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const EXIT_TYPE_CONFIG: Record<
  string,
  { label: string; variant: "info" | "secondary" | "destructive"; icon: React.ReactNode }
> = {
  exit_technician: {
    label: "Sortie technicien",
    variant: "info",
    icon: <User01 className="size-4" />,
  },
  exit_anonymous: {
    label: "Sortie anonyme",
    variant: "secondary",
    icon: <UserX01 className="size-4" />,
  },
  exit_loss: {
    label: "Perte / Casse",
    variant: "destructive",
    icon: <Trash01 className="size-4" />,
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return generateMeta({
    title: "Détail de la sortie",
    description: "Détails du mouvement de sortie de stock",
    canonical: `/orders/outcome/${id}`,
  });
}

async function getMovement(id: string) {
  const supabase = await createClient();

  const { data: movement, error } = await supabase
    .from("stock_movements")
    .select(
      `
      *,
      product:products(id, name, sku, image_url, price, stock_current),
      technician:technicians(id, first_name, last_name, email, city)
    `
    )
    .eq("id", id)
    .neq("movement_type", "entry")
    .single();

  if (error || !movement) {
    return null;
  }

  const product = Array.isArray(movement.product)
    ? movement.product[0]
    : movement.product;
  const technician = Array.isArray(movement.technician)
    ? movement.technician[0]
    : movement.technician;

  return { ...movement, product, technician };
}

export default async function OutcomeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const movement = await getMovement(id);

  if (!movement) {
    notFound();
  }

  const exitDate = new Date(movement.created_at);
  const exitType = movement.movement_type as string;
  const config = EXIT_TYPE_CONFIG[exitType] || EXIT_TYPE_CONFIG.exit_anonymous;
  const unitPrice = movement.product?.price || 0;
  const totalValue = unitPrice * movement.quantity;

  return (
    <div className="mx-auto max-w-screen-lg space-y-4 lg:mt-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button asChild variant="outline">
          <Link href="/orders">
            <ChevronLeft />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Upload01 className="size-5 text-red-600" />
              <CardTitle className="font-display text-2xl">
                Sortie de stock
              </CardTitle>
            </div>
            <p className="text-muted-foreground text-sm">
              {exitDate.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              à{" "}
              {exitDate.toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </CardHeader>
          <CardContent>
            <Separator className="mb-4" />
            <div className="space-y-4">
              {/* Type de sortie */}
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  {config.icon}
                  Type de sortie
                </h3>
                <Badge variant={config.variant}>{config.label}</Badge>
              </div>

              {/* Technicien */}
              {movement.technician && exitType === "exit_technician" && (
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <User01 className="size-4" />
                    Technicien
                  </h3>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-10">
                      <AvatarFallback>
                        {movement.technician.first_name[0]}
                        {movement.technician.last_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {movement.technician.first_name}{" "}
                        {movement.technician.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {movement.technician.email}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Alerte perte */}
              {exitType === "exit_loss" && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">
                  <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-destructive">
                    Produit marqué comme perte ou casse.
                  </p>
                </div>
              )}

              {/* Notes */}
              {movement.notes && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Notes</h3>
                  <p className="text-muted-foreground text-sm">
                    {movement.notes}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle>Résumé de la sortie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span>Quantité</span>
              <Badge variant="destructive">-{movement.quantity} unités</Badge>
            </div>
            <div className="flex justify-between">
              <span>Prix unitaire</span>
              <span>
                {unitPrice.toLocaleString("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                })}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Valeur sortie</span>
              <span className="text-red-600">
                {totalValue.toLocaleString("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                })}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="size-5" />
            Produit sorti
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead className="text-right">Prix unitaire</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>
                  <div className="flex items-center gap-4">
                    <figure className="flex size-14 items-center justify-center rounded-lg border bg-muted">
                      {movement.product?.image_url ? (
                        <Image
                          src={movement.product.image_url}
                          width={56}
                          height={56}
                          alt={movement.product.name}
                          className="size-full rounded-lg object-cover"
                        />
                      ) : (
                        <Image01 className="size-6 text-muted-foreground" />
                      )}
                    </figure>
                    <div>
                      <p className="font-medium">
                        {movement.product?.name || "Produit inconnu"}
                      </p>
                      {movement.product?.sku && (
                        <p className="text-xs text-muted-foreground font-mono">
                          {movement.product.sku}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold text-red-600">
                  -{movement.quantity}
                </TableCell>
                <TableCell className="text-right">
                  {unitPrice.toLocaleString("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                  })}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {totalValue.toLocaleString("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                  })}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {movement.technician && (
          <Button variant="outline" asChild>
            <Link href={`/users/${movement.technician.id}`}>
              Voir le technicien
            </Link>
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link href={`/product/${movement.product?.id}`}>
            Voir le produit
          </Link>
        </Button>
      </div>
    </div>
  );
}
