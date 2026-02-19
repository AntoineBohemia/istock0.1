import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Download01,
  Package,
  Truck01,
  Image01,
} from "@untitled-ui/icons-react";
import { generateMeta } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return generateMeta({
    title: "Détail de l'entrée",
    description: "Détails du mouvement d'entrée de stock",
    canonical: `/orders/income/${id}`,
  });
}

async function getMovement(id: string) {
  const supabase = await createClient();

  const { data: movement, error } = await supabase
    .from("stock_movements")
    .select(
      `
      *,
      product:products(id, name, sku, image_url, price, stock_current, supplier_name)
    `
    )
    .eq("id", id)
    .eq("movement_type", "entry")
    .single();

  if (error || !movement) {
    return null;
  }

  const product = Array.isArray(movement.product)
    ? movement.product[0]
    : movement.product;

  return { ...movement, product };
}

export default async function EntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const movement = await getMovement(id);

  if (!movement) {
    notFound();
  }

  const entryDate = new Date(movement.created_at ?? Date.now());
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
              <Download01 className="size-5 text-green-600" />
              <CardTitle className="font-display text-2xl">
                Entrée de stock
              </CardTitle>
            </div>
            <p className="text-muted-foreground text-sm">
              {entryDate.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              à{" "}
              {entryDate.toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </CardHeader>
          <CardContent>
            <Separator className="mb-4" />
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Truck01 className="size-4" />
                  Fournisseur
                </h3>
                <p>{movement.product?.supplier_name || "Non spécifié"}</p>
              </div>
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
            <CardTitle>Résumé de l&apos;entrée</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span>Quantité</span>
              <Badge variant="success">+{movement.quantity} unités</Badge>
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
              <span>Valeur totale</span>
              <span className="text-green-600">
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
            Produit réapprovisionné
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
                <TableCell className="text-right font-semibold text-green-600">
                  +{movement.quantity}
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
      <div className="flex justify-end">
        <Button variant="outline" asChild>
          <Link href={`/product/${movement.product?.id}`}>
            Voir le produit
          </Link>
        </Button>
      </div>
    </div>
  );
}
