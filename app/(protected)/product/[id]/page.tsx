import { generateMeta } from "@/lib/utils";
import { Edit3Icon, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calculateStockScore, getStockBadgeVariant, getStockScoreColor } from "@/lib/utils/stock";
import dynamic from "next/dynamic";
import ArchiveProductButton from "./archive-product-button";
import ProductIconDisplay from "@/components/product-icon-display";
import StockActions from "./stock-actions";
import RecentMovements from "./recent-movements";
import { cn } from "@/lib/utils";

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

  const stockScore = calculateStockScore(
    product.stock_current,
    product.stock_min,
    product.stock_max
  );
  const stockBadgeVariant = getStockBadgeVariant(stockScore);
  const stockColor = getStockScoreColor(stockScore);
  const totalValue = (product.price || 0) * (product.stock_current ?? 0);

  return (
    <div className="space-y-5 pb-20">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="shrink-0 -ml-2">
              <Link href="/product">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="font-heading text-2xl font-bold tracking-tight truncate">
                {product.name}
              </h1>
              {product.sku && (
                <p className="text-sm text-muted-foreground font-mono">{product.sku}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline-contrast" asChild>
            <Link href={`/product/${id}/edit`}>
              <Edit3Icon className="size-4" />
              Modifier
            </Link>
          </Button>
          <ArchiveProductButton productId={id} productName={product.name} />
        </div>
      </div>

      {/* ── Content ── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* ── Left column ── */}
        <div className="space-y-5">
          {/* Stock hero */}
          <div className="rounded-xl border bg-card px-6 py-5 flex items-end justify-between gap-4">
            <div>
              <span
                className={cn(
                  "font-heading text-5xl font-bold tabular-nums leading-none block",
                  stockColor
                )}
              >
                {product.stock_current ?? 0}
              </span>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-muted-foreground text-sm">
                  min{" "}
                  <span className="font-semibold text-foreground">{product.stock_min ?? 0}</span>
                </span>
                <StatusPill status={stockBadgeVariant} />
              </div>
            </div>
            <StockActions productId={id} />
          </div>

          {/* Détails */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-5 pt-4 pb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50">
                Détails
              </p>
            </div>
            <div className="divide-y text-sm">
              <div className="flex justify-between px-5 py-2.5">
                <span className="text-muted-foreground">Prix HT</span>
                <span className="font-semibold tabular-nums">
                  {product.price
                    ? product.price.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between px-5 py-2.5">
                <span className="text-muted-foreground">Valeur en stock</span>
                <span className="font-semibold tabular-nums">
                  {totalValue.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                </span>
              </div>
              {product.category?.name && (
                <div className="flex justify-between px-5 py-2.5">
                  <span className="text-muted-foreground">Catégorie</span>
                  <span className="font-medium">{product.category.name}</span>
                </div>
              )}
              {product.supplier?.name && (
                <div className="flex justify-between px-5 py-2.5">
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
              {product.description && (
                <div className="flex justify-between px-5 py-2.5">
                  <span className="text-muted-foreground">Description</span>
                  <span className="font-medium text-right max-w-[60%]">{product.description}</span>
                </div>
              )}
              <div className="flex justify-between px-5 py-2.5">
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
          </div>

          {/* Mouvements récents */}
          <RecentMovements productId={id} />
        </div>

        {/* ── Right column ── */}
        <div className="space-y-5">
          {/* Image */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <ProductIconDisplay
              iconName={product.icon_name}
              iconColor={product.icon_color}
              imageUrl={product.image_url}
              size="xl"
            />
          </div>

          {/* QR Code */}
          <div className="hidden lg:block">
            <ProductQRCode productId={id} productName={product.name} productSku={product.sku} />
          </div>
        </div>
      </div>

      {/* QR Code — mobile */}
      <div className="lg:hidden">
        <ProductQRCode productId={id} productName={product.name} productSku={product.sku} />
      </div>
    </div>
  );
}
