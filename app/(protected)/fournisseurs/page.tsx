"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Truck, Globe, Mail, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/search-input";
import { StatusPill } from "@/components/ui/status-pill";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ProductIconDisplay from "@/components/product-icon-display";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useSuppliersWithProducts } from "@/hooks/queries/use-suppliers";
import { calculateStockScore, getStockBadgeVariant } from "@/lib/utils/stock";
import type { SupplierProduct } from "@/lib/supabase/queries/suppliers";
import AddNewSupplier from "@/components/add-new-supplier";

function ProductDot({ product, index }: { product: SupplierProduct; index: number }) {
  const score = calculateStockScore(product.stock_current ?? 0, product.stock_min);
  const status = getStockBadgeVariant(score);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="transition-transform duration-300 hover:scale-110 hover:-translate-y-0.5 cursor-default"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <ProductIconDisplay
              iconName={product.icon_name}
              iconColor={product.icon_color}
              imageUrl={product.image_url}
              size="sm"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8} className="flex items-center gap-2">
          <span className="text-xs font-medium">{product.name}</span>
          <span className="font-heading tabular-nums text-xs font-bold">
            {product.stock_current ?? 0}
          </span>
          <StatusPill status={status} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function FournisseursPage() {
  const orgId = useOrganizationStore((s) => s.currentOrganization?.id);
  const { data: suppliers = [], isLoading } = useSuppliersWithProducts(orgId);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.email ?? "").toLowerCase().includes(q)
    );
  }, [suppliers, search]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-52 rounded-md" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-2 min-w-0 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="flex gap-1.5">
                {[...Array(4)].map((_, j) => (
                  <Skeleton key={j} className="size-8 rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Fournisseurs</h1>
        <AddNewSupplier
          trigger={
            <Button>
              <Plus className="mr-2 size-4" />
              Ajouter un fournisseur
            </Button>
          }
        />
      </div>

      {suppliers.length > 3 && (
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Rechercher un fournisseur..."
          className="bg-white dark:bg-card"
        />
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-muted mb-4">
            <Truck className="size-6 text-muted-foreground" />
          </div>
          <h3 className="font-heading font-semibold">
            {search ? "Aucun fournisseur trouvé" : "Aucun fournisseur"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {search
              ? "Essayez un autre terme de recherche."
              : "Ajoutez votre premier fournisseur pour suivre vos approvisionnements."}
          </p>
          {!search && (
            <div className="mt-4">
              <AddNewSupplier
                trigger={
                  <Button>
                    <Plus className="mr-2 size-4" />
                    Ajouter un fournisseur
                  </Button>
                }
              />
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((supplier) => (
            <Link
              key={supplier.id}
              href={`/fournisseurs/${supplier.id}`}
              className="group rounded-xl border bg-card p-4 flex flex-col gap-3 transition-all hover:border-primary/40 active:scale-[0.98]"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-heading font-semibold text-sm truncate group-hover:text-primary transition-colors">
                    {supplier.name}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {supplier.email && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="size-3 shrink-0" />
                        <span className="truncate">{supplier.email}</span>
                      </span>
                    )}
                    {supplier.website_url && (
                      <span className="flex items-center gap-1">
                        <Globe className="size-3 shrink-0" />
                        Site
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums font-heading shrink-0">
                  {supplier.products.length} produit{supplier.products.length > 1 ? "s" : ""}
                </span>
              </div>

              {/* Product icons */}
              {supplier.products.length > 0 && (
                <div className="flex flex-wrap gap-1.5 items-center">
                  {supplier.products.slice(0, 8).map((p, i) => (
                    <ProductDot key={p.id} product={p} index={i} />
                  ))}
                  {supplier.products.length > 8 && (
                    <span className="flex items-center justify-center size-8 rounded-lg border bg-muted text-[11px] font-heading font-semibold text-muted-foreground">
                      +{supplier.products.length - 8}
                    </span>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Footer count */}
      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-center tabular-nums">
          {filtered.length} sur {suppliers.length} fournisseur{suppliers.length > 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
