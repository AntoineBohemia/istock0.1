"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Truck, Globe, Mail, Phone, Plus, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/search-input";
import { StatusPill } from "@/components/ui/status-pill";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ProductIconDisplay from "@/components/product-icon-display";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useSuppliersWithStats } from "@/hooks/queries/use-suppliers";
import { formatPhone } from "@/lib/utils/phone";
import { calculateStockScore, getStockBadgeVariant } from "@/lib/utils/stock";
import type { SupplierProduct, SupplierWithStats } from "@/lib/supabase/queries/suppliers";
import AddNewSupplier from "@/components/add-new-supplier";
import { cn } from "@/lib/utils";

// ── Formatage ──

const fmtPrice = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

/** Un fournisseur sans achat depuis 12 mois merite d'etre signale */
const DORMANT_MS = 365 * 86_400_000;
const isDormant = (last: string | null) =>
  last !== null && Date.now() - new Date(last).getTime() > DORMANT_MS;

// ── Tri ──

type SortKey = "name" | "spend" | "recent" | "alerts";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Nom" },
  { key: "spend", label: "Dépense" },
  { key: "recent", label: "Récent" },
  { key: "alerts", label: "Alertes" },
];

function sortSuppliers(list: SupplierWithStats[], key: SortKey): SupplierWithStats[] {
  const sorted = [...list];
  switch (key) {
    case "spend":
      return sorted.sort((a, b) => b.total_purchased - a.total_purchased);
    case "recent":
      // Jamais commande : rejete en fin de liste plutot que traite comme tres ancien
      return sorted.sort((a, b) => {
        const ta = a.last_purchase_at ? new Date(a.last_purchase_at).getTime() : -Infinity;
        const tb = b.last_purchase_at ? new Date(b.last_purchase_at).getTime() : -Infinity;
        return tb - ta;
      });
    case "alerts":
      return sorted.sort(
        (a, b) => b.alert_count - a.alert_count || a.name.localeCompare(b.name, "fr")
      );
    default:
      return sorted.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }
}

// ── Icone produit ──
// Le TooltipProvider vit au niveau de la page : un provider par icone en
// instanciait pres de 200 sur une page de 26 fournisseurs.

function ProductDot({ product }: { product: SupplierProduct }) {
  const score = calculateStockScore(product.stock_current ?? 0, product.stock_min);
  const status = getStockBadgeVariant(score);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="transition-transform duration-300 hover:scale-110 hover:-translate-y-0.5 cursor-default">
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
  );
}

// ── Carte fournisseur ──

function SupplierCard({ supplier }: { supplier: SupplierWithStats }) {
  const dormant = isDormant(supplier.last_purchase_at);

  return (
    <Link
      href={`/fournisseurs/${supplier.id}`}
      className="group rounded-xl border bg-card p-4 flex flex-col gap-3 transition-all hover:border-primary/40 active:scale-[0.98]"
    >
      {/* Identite */}
      <div className="flex items-start gap-2.5">
        {/* Logo, ou l'initiale a defaut : un carre vide ferait un trou visuel */}
        <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {supplier.logo_url ? (
            <img src={supplier.logo_url} alt="" className="size-full object-contain" />
          ) : (
            <span className="font-heading text-xs font-bold text-muted-foreground">
              {supplier.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading font-semibold text-sm truncate group-hover:text-primary transition-colors">
            {supplier.name}
          </h3>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {supplier.email && (
              <span className="flex items-center gap-1 truncate min-w-0">
                <Mail className="size-3 shrink-0" />
                <span className="truncate">{supplier.email}</span>
              </span>
            )}
            {supplier.phone && (
              <span className="flex items-center gap-1 shrink-0">
                <Phone className="size-3" />
                {formatPhone(supplier.phone)}
              </span>
            )}
            {supplier.website_url && (
              <span className="flex items-center gap-1 shrink-0">
                <Globe className="size-3" />
                Site
              </span>
            )}
          </div>
        </div>

        {/* Produits en alerte : le signal le plus actionnable de la carte */}
        {supplier.alert_count > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-attention/10 text-attention px-2 py-0.5 text-[11px] font-semibold shrink-0">
            <TriangleAlert className="size-3" />
            {supplier.alert_count}
          </span>
        )}
      </div>

      {/* Chiffres d'achat */}
      <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <div className="min-w-0">
          <p className="font-heading text-base font-bold tabular-nums leading-none truncate">
            {supplier.total_purchased > 0 ? fmtPrice(supplier.total_purchased) : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">acheté</p>
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              "text-sm font-medium tabular-nums leading-none truncate",
              dormant && "text-muted-foreground"
            )}
          >
            {supplier.last_purchase_at ? fmtDate(supplier.last_purchase_at) : "Jamais"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {dormant ? "dernier achat · dormant" : "dernier achat"}
          </p>
        </div>
      </div>

      {/* Produits */}
      <div className="flex items-center justify-between gap-2">
        {supplier.products.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 items-center min-w-0">
            {supplier.products.slice(0, 6).map((p) => (
              <ProductDot key={p.id} product={p} />
            ))}
            {supplier.products.length > 6 && (
              <span className="flex items-center justify-center size-8 rounded-lg border bg-muted text-[11px] font-heading font-semibold text-muted-foreground">
                +{supplier.products.length - 6}
              </span>
            )}
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground">Aucun produit lié</span>
        )}
        <span className="text-xs text-muted-foreground tabular-nums font-heading shrink-0">
          {supplier.products.length} produit{supplier.products.length > 1 ? "s" : ""}
        </span>
      </div>
    </Link>
  );
}

// ── Page ──

export default function FournisseursPage() {
  const orgId = useOrganizationStore((s) => s.currentOrganization?.id);
  const { data: suppliers = [], isLoading } = useSuppliersWithStats(orgId);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("name");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = q
      ? suppliers.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.email ?? "").toLowerCase().includes(q) ||
            (s.phone ?? "").toLowerCase().includes(q)
        )
      : suppliers;
    return sortSuppliers(matched, sort);
  }, [suppliers, search, sort]);

  const totalAlerts = useMemo(
    () => suppliers.reduce((sum, s) => sum + s.alert_count, 0),
    [suppliers]
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-52 rounded-md" />
        </div>
        <Skeleton className="h-9 w-full rounded-md" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-2 min-w-0 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
                <Skeleton className="h-4 w-8" />
              </div>
              <Skeleton className="h-12 w-full rounded-lg" />
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
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {/* En-tete */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Fournisseurs</h1>
            {totalAlerts > 0 && (
              <p className="text-sm text-muted-foreground mt-0.5">
                <span className="text-attention font-medium">{totalAlerts} produit</span>
                {totalAlerts > 1 ? "s" : ""} à réapprovisionner
              </p>
            )}
          </div>
          <AddNewSupplier
            trigger={
              <Button variant="outline" className="bg-white dark:bg-card">
                <Plus className="mr-2 size-4" />
                Ajouter un fournisseur
              </Button>
            }
          />
        </div>

        {/* Recherche + tri sur une seule ligne */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[200px]">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Rechercher un fournisseur..."
              className="bg-white dark:bg-card"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg border bg-card p-1 shrink-0">
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  sort === s.key
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

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
                    <Button variant="outline" className="bg-white dark:bg-card">
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
              <SupplierCard key={supplier.id} supplier={supplier} />
            ))}
          </div>
        )}

        {/* Compteur */}
        {filtered.length > 0 && (
          <p className="text-xs text-muted-foreground text-center tabular-nums">
            {filtered.length} sur {suppliers.length} fournisseur{suppliers.length > 1 ? "s" : ""}
          </p>
        )}
      </div>
    </TooltipProvider>
  );
}
