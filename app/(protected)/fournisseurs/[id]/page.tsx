"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Globe, Loader2, Mail, Package, Pencil, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { useSupplier } from "@/hooks/queries/use-suppliers";
import { calculateStockScore, getStockBadgeVariant } from "@/lib/utils/stock";
import EditSupplierModal from "@/components/edit-supplier-modal";

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: supplier, isLoading } = useSupplier(id);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Truck className="size-14 text-muted-foreground/20 mb-4" />
        <h2 className="font-heading font-semibold text-lg">Fournisseur introuvable</h2>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          <ChevronLeft className="size-4 mr-1" />
          Retour
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="size-4" />
        Retour
      </button>

      {/* Hero */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{supplier.name}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            {supplier.email && (
              <a
                href={`mailto:${supplier.email}`}
                className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <Mail className="size-3.5" />
                {supplier.email}
              </a>
            )}
            {supplier.website_url && (
              <a
                href={supplier.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              >
                <Globe className="size-3.5" />
                Site web
              </a>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditOpen(true)}
          className="shrink-0 bg-white dark:bg-card"
        >
          <Pencil className="mr-2 size-3.5" />
          Modifier
        </Button>
      </div>

      {/* Product count */}
      {supplier.products.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {supplier.products.length} produit{supplier.products.length > 1 ? "s" : ""} lié
          {supplier.products.length > 1 ? "s" : ""}
        </p>
      )}

      {/* Products */}
      {supplier.products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border bg-card">
          <Package className="size-12 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">Aucun produit lié à ce fournisseur.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card divide-y">
          {supplier.products.map((product) => {
            const score = calculateStockScore(product.stock_current ?? 0, product.stock_min);
            const status = getStockBadgeVariant(score);
            return (
              <Link
                key={product.id}
                href={`/produits/${product.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <span className="text-sm font-medium truncate">{product.name}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-heading font-bold tabular-nums text-sm">
                    {product.stock_current ?? 0}
                  </span>
                  <StatusPill status={status} />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <EditSupplierModal supplier={supplier} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}
