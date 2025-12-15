import { generateMeta } from "@/lib/utils";
import ProductImageGallery from "./product-image-gallery";
import {
  CircleDollarSign,
  Edit3Icon,
  Layers2Icon,
  Trash2Icon,
  TruckIcon,
  ArrowLeft,
  Package,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  calculateStockScore,
  getStockStatus,
  getStockBadgeVariant,
  getStockScoreBgColor,
} from "@/lib/utils/stock";
import DeleteProductButton from "./delete-product-button";
import StockEvolutionChart from "./stock-evolution-chart";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("name")
    .eq("id", id)
    .single();

  return generateMeta({
    title: product?.name || "Détail du produit",
    description: "Détails et informations du produit",
    canonical: `/product/${id}`,
  });
}

async function getProduct(id: string) {
  const supabase = await createClient();

  const { data: product, error } = await supabase
    .from("products")
    .select("*, category:categories(*)")
    .eq("id", id)
    .single();

  if (error || !product) {
    return null;
  }

  return product;
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    notFound();
  }

  const stockScore = calculateStockScore(
    product.stock_current,
    product.stock_min,
    product.stock_max
  );
  const stockStatus = getStockStatus(stockScore);
  const stockBadgeVariant = getStockBadgeVariant(stockScore);
  const stockBgColor = getStockScoreBgColor(stockScore);

  const totalValue = (product.price || 0) * product.stock_current;

  return (
    <div className="space-y-4">
      <div className="flex flex-row items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/product">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <h1 className="font-display text-xl tracking-tight lg:text-2xl">
              {product.name}
            </h1>
          </div>
          <div className="text-muted-foreground inline-flex flex-col gap-2 text-sm lg:flex-row lg:gap-4">
            {product.supplier_name && (
              <div>
                <span className="text-foreground font-semibold">
                  Fournisseur :
                </span>{" "}
                {product.supplier_name}
              </div>
            )}
            <div>
              <span className="text-foreground font-semibold">Créé le :</span>{" "}
              {new Date(product.created_at).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
            {product.sku && (
              <div>
                <span className="text-foreground font-semibold">SKU :</span>{" "}
                {product.sku}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button asChild>
            <Link href={`/product/${id}/edit`}>
              <Edit3Icon />
              <span className="hidden lg:inline">Modifier</span>
            </Link>
          </Button>
          <DeleteProductButton productId={id} productName={product.name} />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-1">
          <ProductImageGallery imageUrl={product.image_url} />
        </div>
        <div className="space-y-4 xl:col-span-2">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="hover:border-primary/30 bg-muted grid auto-cols-max grid-flow-col gap-4 rounded-lg border p-4">
              <CircleDollarSign className="size-6 opacity-40" />
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-sm">
                  Prix unitaire
                </span>
                <span className="text-lg font-semibold">
                  {product.price
                    ? product.price.toLocaleString("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                      })
                    : "Non défini"}
                </span>
              </div>
            </div>
            <div className="hover:border-primary/30 bg-muted grid auto-cols-max grid-flow-col gap-4 rounded-lg border p-4">
              <Layers2Icon className="size-6 opacity-40" />
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-sm">
                  Niveau de stock
                </span>
                <span className="text-lg font-semibold">
                  {stockScore}% - {stockStatus}
                </span>
              </div>
            </div>
            <div className="hover:border-primary/30 bg-muted grid auto-cols-max grid-flow-col gap-4 rounded-lg border p-4">
              <TruckIcon className="size-6 opacity-40" />
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-sm">
                  Stock actuel
                </span>
                <span className="text-lg font-semibold">
                  {product.stock_current}
                </span>
              </div>
            </div>

            <div className="hover:border-primary/30 bg-muted grid auto-cols-max grid-flow-col gap-4 rounded-lg border p-4">
              <Package className="size-6 opacity-40" />
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-sm">
                  Valeur stock
                </span>
                <span className="text-lg font-semibold">
                  {totalValue.toLocaleString("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                  })}
                </span>
              </div>
            </div>
          </div>
          <Card>
            <CardContent className="space-y-4">
              <div className="grid items-start gap-8 xl:grid-cols-3">
                <div className="space-y-8 xl:col-span-2">
                  {product.description && (
                    <div>
                      <h3 className="mb-2 font-semibold">Description :</h3>
                      <p className="text-muted-foreground">
                        {product.description}
                      </p>
                    </div>
                  )}

                  {/* Stock level indicator */}
                  <div>
                    <h3 className="mb-4 font-semibold">
                      Indicateur de niveau de stock :
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span>
                          {product.stock_current} / {product.stock_max} unités
                        </span>
                        <Badge variant={stockBadgeVariant}>{stockStatus}</Badge>
                      </div>
                      <Progress value={stockScore} color={stockBgColor} />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Min: {product.stock_min}</span>
                        <span>Max: {product.stock_max}</span>
                      </div>
                    </div>
                  </div>

                  {product.stock_current <= product.stock_min && (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                      <AlertTriangle className="size-4" />
                      <span>
                        {product.stock_current === 0
                          ? "Rupture de stock ! Réapprovisionnement urgent."
                          : "Stock bas ! Le niveau minimum est atteint."}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-6 xl:col-span-1">
                  <div className="rounded-md border">
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-semibold">
                            Catégorie
                          </TableCell>
                          <TableCell className="text-right">
                            {product.category?.name || "Non catégorisé"}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-semibold">
                            Fournisseur
                          </TableCell>
                          <TableCell className="text-right">
                            {product.supplier_name || "-"}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-semibold">
                            Périssable
                          </TableCell>
                          <TableCell className="text-right">
                            {product.is_perishable ? "Oui" : "Non"}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-semibold">
                            Suivi stock
                          </TableCell>
                          <TableCell className="text-right">
                            {product.track_stock ? "Actif" : "Désactivé"}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-semibold">
                            Niveau critique
                          </TableCell>
                          <TableCell className="text-right">
                            {product.stock_min}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-semibold">
                            Niveau optimal
                          </TableCell>
                          <TableCell className="text-right">
                            {product.stock_max}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button asChild>
                  <Link href={`/product/${id}/edit`}>
                    <Edit3Icon /> Modifier le produit
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Stock Evolution Chart */}
          <StockEvolutionChart productId={id} />
        </div>
      </div>
    </div>
  );
}
