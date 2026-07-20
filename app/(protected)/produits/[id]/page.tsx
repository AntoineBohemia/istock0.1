import { generateMeta, cn } from "@/lib/utils";

import { AlertTriangle, Mail, Phone } from "lucide-react";

import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calculateStockScore, getStockBadgeVariant, getStockScoreColor } from "@/lib/utils/stock";
import dynamic from "next/dynamic";
import ArchiveProductButton from "./archive-product-button";
import EditProductButton from "./edit-product-button";
import ProductIconDisplay from "@/components/product-icon-display";
import StockActions from "./stock-actions";
import RecentMovements from "./recent-movements";
import PriceHistory from "./price-history";

const ProductQRCode = dynamic(() => import("@/components/product-qr-code"));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("name").eq("id", id).single();

  return generateMeta({
    title: product?.name || "Détail du produit",
    description: "Détails et informations du produit",
    canonical: `/produits/${id}`,
  });
}

async function getProduct(id: string) {
  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .select(
      "*, category:categories(*), supplier:suppliers(*), product_organization_stock(organization_id, stock_current, organization:organizations(name))"
    )
    .eq("id", id)
    .single();

  if (error || !product) return null;
  return product;
}

async function getUserOrgs() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("user_organizations")
    .select("organization:organizations(id, name)")
    .eq("user_id", user.id);
  return (data || []).map((d: any) => {
    const org = Array.isArray(d.organization) ? d.organization[0] : d.organization;
    return { id: org.id as string, name: org.name as string };
  });
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, userOrgs] = await Promise.all([getProduct(id), getUserOrgs()]);

  if (!product) notFound();

  const isMultiOrg = userOrgs.length > 1;
  const orgStocks = product.product_organization_stock ?? [];
  const allOrgStocks = isMultiOrg
    ? userOrgs.map((org) => {
        const pos = orgStocks.find((s: any) => s.organization_id === org.id);
        return {
          organization_id: org.id,
          stock_current: pos?.stock_current ?? 0,
          organization: { name: org.name },
        };
      })
    : orgStocks;

  const stockScore = calculateStockScore(product.stock_current, product.stock_min);
  const stockBadgeVariant = getStockBadgeVariant(stockScore);
  const stockColor = getStockScoreColor(stockScore);
  const totalValue = (product.price || 0) * (product.stock_current ?? 0);

  // ── Jauge de stock : position par rapport au seuil (cible = 2× le seuil) ──
  const currentStock = product.stock_current ?? 0;
  const minStock = product.stock_min ?? 0;
  // L'échelle couvre toujours le stock réel : sinon un stock supérieur à 2× le
  // seuil saturerait la barre et l'échelle afficherait une valeur fausse.
  const gaugeTarget =
    minStock > 0 ? Math.max(minStock * 2, currentStock) : Math.max(currentStock, 1);
  const gaugePct = Math.min(100, Math.round((currentStock / gaugeTarget) * 100));
  const thresholdPct =
    minStock > 0 ? Math.min(100, Math.round((minStock / gaugeTarget) * 100)) : null;
  const isBelowThreshold = minStock > 0 && currentStock < minStock;
  const missingUnits = Math.max(0, minStock - currentStock);

  const gaugeBarClass =
    stockBadgeVariant === "critique"
      ? "bg-critique"
      : stockBadgeVariant === "attention"
        ? "bg-attention"
        : "bg-standard";

  // ── Commande directe au fournisseur quand le stock est sous le seuil ──
  const supplier = product.supplier as {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;

  const suggestedQty = Math.max(gaugeTarget - currentStock, 1);
  const orderMailtoUrl = supplier?.email
    ? `mailto:${encodeURIComponent(supplier.email)}?subject=${encodeURIComponent(
        `Commande - ${product.name}`
      )}&body=${encodeURIComponent(
        [
          "Bonjour,",
          "",
          `Nous souhaiterions passer commande pour le produit suivant :`,
          "",
          `- ${product.name}${product.sku ? ` (${product.sku})` : ""} : ${suggestedQty} unite${
            suggestedQty > 1 ? "s" : ""
          }`,
          "",
          "Merci de nous confirmer la disponibilite et les delais de livraison.",
          "",
          "Cordialement",
        ].join("\n")
      )}`
    : null;

  return (
    <div className="space-y-5 pb-20">
      {/* ── Header ── */}
      <PageHeader
        backHref="/produits"
        backLabel="Retour aux produits"
        title={product.name}
        subtitle={
          product.sku ? (
            <p className="text-sm text-muted-foreground font-mono">{product.sku}</p>
          ) : undefined
        }
        actions={
          <>
            {orderMailtoUrl && (
              <Button variant="outline-contrast" asChild>
                <a href={orderMailtoUrl}>
                  <Mail className="size-4" />
                  Commander à nouveau
                </a>
              </Button>
            )}
            <EditProductButton productId={id} />
            <ArchiveProductButton productId={id} productName={product.name} />
          </>
        }
      />

      {/* ── Content ── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* ── Left column ── */}
        <div className="space-y-5">
          {/* Stock hero */}
          <div className="rounded-xl border bg-card px-6 py-5 relative">
            <StatusPill status={stockBadgeVariant} className="absolute top-4 right-4" />
            <div className="flex items-end justify-between gap-4">
              <div>
                <span
                  className={cn(
                    "font-heading text-5xl font-bold tabular-nums leading-none block",
                    stockColor
                  )}
                >
                  {product.stock_current ?? 0}
                </span>
                <p className="text-xs text-muted-foreground mt-1.5 tabular-nums">
                  en stock
                  {minStock > 0 && (
                    <>
                      {" · seuil critique "}
                      <span className="font-semibold text-foreground">{minStock}</span>
                    </>
                  )}
                </p>
                {/* Répartition par organisation — toutes affichées, 0 compris */}
                {isMultiOrg && (
                  <div className="flex items-center gap-3 mt-3">
                    {allOrgStocks
                      .sort((a: any, b: any) => b.stock_current - a.stock_current)
                      .map((pos: any) => (
                        <span
                          key={pos.organization_id}
                          className="text-xs text-muted-foreground tabular-nums"
                        >
                          <span className="font-medium text-foreground">{pos.stock_current}</span>{" "}
                          {pos.organization?.name ?? "—"}
                        </span>
                      ))}
                  </div>
                )}
              </div>
              <StockActions productId={id} />
            </div>

            {/* Jauge — situe le stock par rapport au seuil critique */}
            {minStock > 0 && (
              <div className="mt-4">
                <div className="relative h-2 rounded-full bg-foreground/[0.06] overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", gaugeBarClass)}
                    style={{ width: `${gaugePct}%` }}
                  />
                  {thresholdPct !== null && thresholdPct < 100 && (
                    <span
                      className="absolute top-0 h-full w-0.5 bg-foreground/40"
                      style={{ left: `${thresholdPct}%` }}
                      aria-hidden="true"
                    />
                  )}
                </div>
                {/* L'étiquette du seuil suit la position réelle du repère */}
                <div className="relative mt-1.5 h-4 text-[11px] text-muted-foreground tabular-nums">
                  {(thresholdPct ?? 0) >= 18 && <span className="absolute left-0">0</span>}
                  {thresholdPct !== null && (
                    <span
                      className="absolute -translate-x-1/2 whitespace-nowrap font-medium"
                      style={{ left: `${Math.min(88, Math.max(12, thresholdPct))}%` }}
                    >
                      Seuil {minStock}
                    </span>
                  )}
                  {(thresholdPct ?? 100) <= 82 && (
                    <span className="absolute right-0">{gaugeTarget}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Alerte + commande directe quand le stock est sous le seuil */}
          {isBelowThreshold && (
            <div className="rounded-xl border border-critique/30 bg-critique/[0.04] px-5 py-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-critique/10 shrink-0">
                    <AlertTriangle className="size-4 text-critique" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Stock sous le seuil critique</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Il manque{" "}
                      <span className="font-semibold text-foreground tabular-nums">
                        {missingUnits}
                      </span>{" "}
                      unité{missingUnits > 1 ? "s" : ""} pour revenir au seuil.
                      {supplier ? (
                        <>
                          {" Fournisseur : "}
                          <span className="font-semibold text-foreground">{supplier.name}</span>
                        </>
                      ) : (
                        " Aucun fournisseur associé à ce produit."
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {orderMailtoUrl && (
                    <Button size="sm" className="h-8 text-xs" asChild>
                      <a href={orderMailtoUrl}>
                        <Mail className="size-3.5" />
                        Commander
                      </a>
                    </Button>
                  )}
                  {supplier?.phone && (
                    <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                      <a href={`tel:${supplier.phone.replace(/\s/g, "")}`}>
                        <Phone className="size-3.5" />
                        Appeler
                      </a>
                    </Button>
                  )}
                  {!supplier && (
                    <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                      <a href={`/produits/${id}/modifier`}>Associer un fournisseur</a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Détails */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-5 pt-4 pb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50">
                Détails
              </p>
            </div>
            <div className="divide-y text-sm">
              <div className="flex justify-between px-5 py-2.5">
                <span className="text-muted-foreground">Seuil critique</span>
                <span className="font-semibold tabular-nums">{product.stock_min ?? 0}</span>
              </div>
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
                  <a
                    href={`/fournisseurs/${product.supplier.id}`}
                    className="font-medium underline underline-offset-2 decoration-muted-foreground/40 hover:decoration-foreground transition-colors"
                  >
                    {product.supplier.name}
                  </a>
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

          {/* Historique des prix */}
          <PriceHistory productId={id} />

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
