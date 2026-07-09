import { generateMeta } from "@/lib/utils";
import { Edit3Icon, ArrowLeft, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusPill } from "@/components/ui/status-pill";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  calculateStockScore,
  getStockBadgeVariant,
  getStockScoreBgColor,
} from "@/lib/utils/stock";
import dynamic from "next/dynamic";
import ArchiveProductButton from "./archive-product-button";
import RestockButton from "./restock-button";
import ProductIconDisplay from "@/components/product-icon-display";

const ProductQRCode = dynamic(() => import("@/components/product-qr-code"));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("name").eq("id", id).single();

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
    .select("*, category:categories(*), supplier:suppliers(*)")
    .eq("id", id)
    .single();

  if (error || !product) return null;
  return product;
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) notFound();

  const stockScore = calculateStockScore(product.stock_current, product.stock_min, product.stock_max);
  const stockBadgeVariant = getStockBadgeVariant(stockScore);
  const stockBgColor = getStockScoreBgColor(stockScore);
  const totalValue = (product.price || 0) * (product.stock_current ?? 0);
  const isLowStock = (product.stock_current ?? 0) <= (product.stock_min ?? 0);

  const metaParts: React.ReactNode[] = [];
  if (product.sku) metaParts.push(product.sku);
  if (product.category?.name) metaParts.push(product.category.name);
  if (product.supplier?.name) {
    metaParts.push(
      product.supplier.website_url ? (
        <a
          key="supplier"
          href={product.supplier.website_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {product.supplier.name}
        </a>
      ) : (
        product.supplier.name
      )
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <Button variant="ghost" size="icon" asChild className="shrink-0 -ml-2">
              <Link href="/product">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <h1 className="font-heading text-2xl font-bold tracking-tight truncate">
              {product.name}
            </h1>
          </div>
          {metaParts.length > 0 && (
            <p className="text-sm text-muted-foreground pl-10">
              {metaParts.map((part, i) => (
                <span key={i}>
                  {i > 0 && " · "}
                  {part}
                </span>
              ))}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <RestockButton productId={id} />
          <Button asChild>
            <Link href={`/product/${id}/edit`}>
              <Edit3Icon className="size-4" />
              Modifier
            </Link>
          </Button>
          <ArchiveProductButton productId={id} productName={product.name} />
        </div>
      </div>

      {/* ── Content ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Left column */}
        <div className="space-y-5">
          {/* Stock hero */}
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Stock actuel</p>
                <div className="flex items-baseline gap-3">
                  <span className="font-heading text-5xl font-bold tabular-nums leading-none">
                    {product.stock_current ?? 0}
                  </span>
                  <span className="text-muted-foreground text-lg">
                    / {product.stock_max ?? "—"}
                  </span>
                </div>
              </div>
              <StatusPill status={stockBadgeVariant} className="text-sm px-3 py-1" />
            </div>

            <div className="space-y-1.5">
              <Progress value={stockScore} color={stockBgColor} className="h-2.5" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Min: {product.stock_min ?? 0}</span>
                <span>Max: {product.stock_max ?? 0}</span>
              </div>
            </div>

            {isLowStock && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span className="font-medium">
                    {(product.stock_current ?? 0) === 0
                      ? "Rupture de stock"
                      : "Stock bas — seuil minimum atteint"}
                  </span>
                </div>
                <RestockButton productId={id} />
              </div>
            )}
          </div>

          {/* Prix + Valeur — 2 colonnes */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card px-5 py-4">
              <p className="text-xs text-muted-foreground mb-1">Prix unitaire</p>
              <p className="font-heading text-xl font-semibold tabular-nums">
                {product.price
                  ? product.price.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl border bg-card px-5 py-4">
              <p className="text-xs text-muted-foreground mb-1">Valeur en stock</p>
              <p className="font-heading text-xl font-semibold tabular-nums">
                {totalValue.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
              </p>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="rounded-xl border bg-card px-6 py-4">
              <p className="text-xs text-muted-foreground mb-1">Description</p>
              <p className="text-sm">{product.description}</p>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Image */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <ProductIconDisplay
              iconName={product.icon_name}
              iconColor={product.icon_color}
              imageUrl={product.image_url}
              size="xl"
            />
          </div>

          {/* Infos compactes */}
          <div className="rounded-xl border bg-card divide-y text-sm">
            {product.category?.name && (
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Catégorie</span>
                <span className="font-medium">{product.category.name}</span>
              </div>
            )}
            {product.supplier?.name && (
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">Fournisseur</span>
                <span className="font-medium">
                  {product.supplier.website_url ? (
                    <a
                      href={product.supplier.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {product.supplier.name}
                    </a>
                  ) : (
                    product.supplier.name
                  )}
                </span>
              </div>
            )}
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-muted-foreground">Périssable</span>
              <span className="font-medium">{product.is_perishable ? "Oui" : "Non"}</span>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-muted-foreground">Créé le</span>
              <span className="font-medium">
                {new Date(product.created_at!).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>

          <div className="hidden lg:block">
            <ProductQRCode productId={id} productName={product.name} productSku={product.sku} />
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <ProductQRCode productId={id} productName={product.name} productSku={product.sku} />
      </div>
    </div>
  );
}
