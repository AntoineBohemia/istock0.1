import { generateMeta } from "@/lib/utils";
import ProductImageGallery from "./product-image-gallery";
import {
  CircleDollarSign,
  Edit3Icon,
  Layers2Icon,
  TruckIcon,
  ArrowLeft,
  Package,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import RestockButton from "./restock-button";
import StockEvolutionChart from "./stock-evolution-chart";
import ProductQRCode from "@/components/product-qr-code";

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
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" asChild className="shrink-0">
              <Link href="/product">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <h1 className="font-display text-lg tracking-tight sm:text-xl lg:text-2xl truncate">
              {product.name}
            </h1>
          </div>
          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm pl-12 sm:pl-0">
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
        <div className="flex items-center gap-2 pl-12 sm:pl-0">
          <RestockButton productId={id} />
          <Button asChild size="sm" className="sm:size-default">
            <Link href={`/product/${id}/edit`}>
              <Edit3Icon className="size-4" />
              <span className="hidden sm:inline">Modifier</span>
            </Link>
          </Button>
          <DeleteProductButton productId={id} productName={product.name} />
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left Column - Image & QR Code */}
        <div className="space-y-4 lg:col-span-1">
          <ProductImageGallery imageUrl={product.image_url} />

          {/* QR Code - Hidden on mobile, shown on lg+ */}
          <div className="hidden lg:block">
            <ProductQRCode
              productId={id}
              productName={product.name}
              productSku={product.sku}
            />
          </div>
        </div>

        {/* Right Column - Details */}
        <div className="space-y-4 lg:col-span-2">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <div className="bg-muted rounded-lg border p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <CircleDollarSign className="size-5 sm:size-6 opacity-40 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-muted-foreground text-xs sm:text-sm">
                    Prix unitaire
                  </span>
                  <span className="text-sm sm:text-lg font-semibold truncate">
                    {product.price
                      ? product.price.toLocaleString("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                        })
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-muted rounded-lg border p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <Layers2Icon className="size-5 sm:size-6 opacity-40 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-muted-foreground text-xs sm:text-sm">
                    Niveau
                  </span>
                  <span className="text-sm sm:text-lg font-semibold">
                    {stockScore}%
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-muted rounded-lg border p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <TruckIcon className="size-5 sm:size-6 opacity-40 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-muted-foreground text-xs sm:text-sm">
                    Stock actuel
                  </span>
                  <span className="text-sm sm:text-lg font-semibold">
                    {product.stock_current}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-muted rounded-lg border p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <Package className="size-5 sm:size-6 opacity-40 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-muted-foreground text-xs sm:text-sm">
                    Valeur
                  </span>
                  <span className="text-sm sm:text-lg font-semibold truncate">
                    {totalValue.toLocaleString("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Stock Alert */}
          {product.stock_current <= product.stock_min && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                {product.stock_current === 0
                  ? "Rupture de stock ! Réapprovisionnement urgent."
                  : "Stock bas ! Le niveau minimum est atteint."}
              </span>
            </div>
          )}

          {/* Details Card */}
          <Card>
            <CardContent className="space-y-6 pt-6">
              {/* Description */}
              {product.description && (
                <div>
                  <h3 className="mb-2 font-semibold text-sm sm:text-base">Description</h3>
                  <p className="text-muted-foreground text-sm">
                    {product.description}
                  </p>
                </div>
              )}

              {/* Stock Progress */}
              <div>
                <h3 className="mb-3 font-semibold text-sm sm:text-base">
                  Niveau de stock
                </h3>
                <div className="space-y-2">
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

              {/* Product Info Table */}
              <div>
                <h3 className="mb-3 font-semibold text-sm sm:text-base">Informations</h3>
                <div className="rounded-md border">
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium text-sm">Catégorie</TableCell>
                        <TableCell className="text-right text-sm">
                          {product.category?.name || "Non catégorisé"}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-sm">Fournisseur</TableCell>
                        <TableCell className="text-right text-sm">
                          {product.supplier_name || "-"}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-sm">Périssable</TableCell>
                        <TableCell className="text-right text-sm">
                          {product.is_perishable ? "Oui" : "Non"}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-sm">Suivi stock</TableCell>
                        <TableCell className="text-right text-sm">
                          {product.track_stock ? "Actif" : "Désactivé"}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button asChild size="sm">
                  <Link href={`/product/${id}/edit`}>
                    <Edit3Icon className="size-4" />
                    Modifier le produit
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Stock Evolution Chart */}
          <StockEvolutionChart productId={id} />
        </div>
      </div>

      {/* QR Code - Mobile only (at bottom) */}
      <div className="lg:hidden">
        <ProductQRCode
          productId={id}
          productName={product.name}
          productSku={product.sku}
        />
      </div>
    </div>
  );
}
