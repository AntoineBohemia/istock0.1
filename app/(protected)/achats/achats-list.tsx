"use client";

import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDebouncedValue } from "@/hooks/use-debounce";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Package, ChevronDown, Building2, Check, Wrench, X } from "lucide-react";
import { SearchInput } from "@/components/search-input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductWithRelations } from "@/lib/supabase/queries/products";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useOrganizations } from "@/hooks/queries";
import { useYearlyPurchases } from "@/hooks/queries/use-stock-movements";
import type { OrgEntryDetail } from "@/lib/supabase/queries/stock-movements";
import ProductIconDisplay from "@/components/product-icon-display";
import { TableColumnToggle } from "@/components/table-column-toggle";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { cn } from "@/lib/utils";
import { useAchatsYear } from "./achats-year-context";

// ─── Sort header button ────────────────────────────────────
function SortHeader({
  label,
  column,
  className,
}: {
  label: string;
  column: { toggleSorting: (asc: boolean) => void; getIsSorted: () => false | "asc" | "desc" };
  className?: string;
}) {
  const sorted = column.getIsSorted();
  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(sorted === "asc")}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/50 hover:text-foreground transition-colors select-none",
        className
      )}
    >
      {label}
      <ArrowUpDown
        className={cn(
          "size-3 transition-colors",
          sorted ? "text-foreground" : "text-foreground/25"
        )}
      />
    </button>
  );
}

// ─── Collapsible org detail cards ─────────────────────────
function OrgDetailCards({
  productId,
  entryData,
  orgNameById,
}: {
  productId: string;
  entryData: Record<string, OrgEntryDetail>;
  orgNameById: Map<string, string>;
}) {
  const orgEntries = Object.entries(entryData).sort(([, a], [, b]) => b.qty - a.qty);
  const fmt = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

  return (
    <tr key={`detail-cards-${productId}`} className="border-b">
      <td colSpan={7} className="px-5 pb-4 pt-2">
        <div className="flex flex-col gap-2">
          {orgEntries.map(([orgId, detail]) => {
            const orgName = orgNameById.get(orgId) ?? orgId;
            const orgTotal = detail.byPrice.reduce((s, bp) => s + bp.unitPrice * bp.qty, 0);

            return (
              <div
                key={`${productId}-${orgId}`}
                className="rounded-lg border bg-muted/20 px-4 py-3"
              >
                {/* Card header */}
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-sm font-semibold text-foreground">{orgName}</span>
                  <div className="flex items-baseline gap-3">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {detail.qty} unité{detail.qty > 1 ? "s" : ""}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">{fmt(orgTotal)}</span>
                  </div>
                </div>

                {/* Price breakdown lines */}
                <div className="space-y-1">
                  {detail.byPrice.map((bp, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-[13px] text-muted-foreground"
                    >
                      <span className="tabular-nums">
                        {fmt(bp.unitPrice)} <span className="text-foreground/30 mx-1">×</span>{" "}
                        <span className="font-medium text-foreground">{bp.qty}</span>
                      </span>
                      <span className="tabular-nums font-medium text-foreground/70">
                        {fmt(bp.unitPrice * bp.qty)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Suppliers breakdown */}
                {detail.suppliers.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/60 pt-2">
                    {detail.suppliers.map((s, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {s.name}
                        <span className="tabular-nums font-medium text-foreground/70">{s.qty}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </td>
    </tr>
  );
}

// ─── Main component ────────────────────────────────────────
export default function AchatsList() {
  const router = useRouter();
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();
  // Dernier achat en tete : la question qu'on se pose en ouvrant la page est
  // « qu'ai-je achete recemment ? », pas « quel poste pese le plus ».
  const [sorting, setSorting] = useState<SortingState>([{ id: "lastPurchase", desc: true }]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [columnVisibility, setColumnVisibility] = useColumnVisibility("achats");

  // Search: local state + debounce
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [filterOrgs, setFilterOrgs] = useState<Set<string>>(new Set());

  const toggleSet = (prev: Set<string>, value: string) => {
    const next = new Set(prev);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const { data: userOrgs } = useOrganizations();
  // Annee pilotee par le selecteur de la page, partagee avec les cartes.
  const { year: currentYear } = useAchatsYear();

  // La page part des ACHATS, plus du catalogue. Un produit archive faisait
  // auparavant disparaitre ses achats de l'historique : 525 EUR depenses
  // s'evaporaient, et les totaux annuels bougeaient au gre du menage dans le
  // catalogue. Un achat est un fait date, il reste.
  const { data: purchases = [], isLoading } = useYearlyPurchases(currentYear);
  const isEntriesLoading = isLoading;

  // Les colonnes existantes attendent un produit et une table de detail :
  // on les derive des achats plutot que de reecrire tout le tableau.
  const entryQtyByProduct = useMemo(() => {
    const map: Record<string, Record<string, OrgEntryDetail>> = {};
    for (const p of purchases) map[p.product_id] = p.byOrg;
    return map;
  }, [purchases]);

  const products = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return purchases
      .filter((p) => {
        if (filterOrgs.size > 0 && ![...filterOrgs].some((orgId) => p.byOrg[orgId])) return false;
        if (!q) return true;
        return (
          p.product_name.toLowerCase().includes(q) ||
          (p.product_sku ?? "").toLowerCase().includes(q)
        );
      })
      .map(
        (p) =>
          ({
            id: p.product_id,
            name: p.product_name,
            sku: p.product_sku,
            image_url: p.product_image_url,
            icon_name: p.product_icon_name,
            icon_color: p.product_icon_color,
            price: p.product_price,
            product_type: p.product_type,
            is_archived: p.is_archived,
            last_purchase_at: p.lastPurchaseAt,
          }) as unknown as ProductWithRelations & { is_archived: boolean }
      );
  }, [purchases, filterOrgs, debouncedSearch]);

  const orgNameById = useMemo(() => {
    const map = new Map<string, string>();
    userOrgs?.forEach((o) => map.set(o.id, o.name));
    return map;
  }, [userOrgs]);

  // Échelle des micro-barres, calculée sur les seuls consommables : un outil
  // coûteux écraserait sinon toutes les barres alors qu'il ne fait pas partie
  // du total des achats.
  const maxValue = useMemo(() => {
    let mV = 1;
    for (const p of products) {
      if ((p as unknown as { product_type?: string }).product_type === "equipment") continue;
      const data = entryQtyByProduct?.[p.id];
      if (!data) continue;
      const val = Object.values(data).reduce(
        (s, d) => s + d.byPrice.reduce((ps, bp) => ps + bp.unitPrice * bp.qty, 0),
        0
      );
      if (val > mV) mV = val;
    }
    return mV;
  }, [products, entryQtyByProduct]);

  const toggleExpand = (productId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const columns: ColumnDef<ProductWithRelations>[] = useMemo(
    () => [
      {
        id: "expand",
        header: () => null,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const data = entryQtyByProduct?.[row.original.id];
          if (!data) return null;
          const hasMultiPrice = Object.values(data).some((d) => d.byPrice.length > 1);
          const hasMultiOrg = Object.keys(data).length > 1;
          const hasMultiSupplier = Object.values(data).some((d) => d.suppliers.length > 1);
          if (!hasMultiOrg && !hasMultiPrice && !hasMultiSupplier) return null;
          const isExpanded = expandedRows.has(row.original.id);
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(row.original.id);
              }}
              className={cn(
                "size-7 rounded-lg border flex items-center justify-center shrink-0 transition-all",
                isExpanded
                  ? "bg-primary border-primary"
                  : "bg-muted/50 border-border hover:border-primary/40 hover:bg-muted"
              )}
            >
              <ChevronDown
                className={cn(
                  "size-4 transition-transform",
                  isExpanded ? "rotate-180 text-primary-foreground" : "text-muted-foreground"
                )}
              />
            </button>
          );
        },
        meta: { width: "w-12" },
      },
      {
        accessorKey: "name",
        enableHiding: false,
        header: ({ column }) => <SortHeader label="Produit" column={column} />,
        cell: ({ row }) => {
          const product = row.original;
          return (
            <div className="flex items-center gap-4">
              <ProductIconDisplay
                iconName={product.icon_name}
                iconColor={product.icon_color}
                imageUrl={product.image_url}
                size="lg"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[15px] leading-tight">{product.name}</span>
                  {/* L'outillage figure ici a titre indicatif : il ne compte ni
                      dans la somme des achats ni dans la valeur de stock. */}
                  {/* Produit archive : l'achat reste dans l'historique, la
                      fiche n'est plus au catalogue. */}
                  {(product as unknown as { is_archived?: boolean }).is_archived && (
                    <span
                      className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground shrink-0"
                      title="Produit archivé — l'achat reste dans l'historique"
                    >
                      Archivé
                    </span>
                  )}
                  {product.product_type === "equipment" && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary shrink-0"
                      title="Outillage — hors totaux d'achats et de stock"
                    >
                      <Wrench className="size-3" />
                      Outillage
                    </span>
                  )}
                </div>
                {product.sku && (
                  <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                    {product.sku}
                  </div>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "price",
        header: ({ column }) => <SortHeader label="Prix HT" column={column} />,
        cell: ({ row }) => {
          const price = row.original.price;
          const data = entryQtyByProduct?.[row.original.id];
          const priceCount = data
            ? new Set(Object.values(data).flatMap((d) => d.byPrice.map((bp) => bp.unitPrice))).size
            : 0;

          return (
            <div className="flex flex-col items-start gap-0.5">
              <span className="font-heading tabular-nums text-[15px] text-foreground">
                {price
                  ? price.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })
                  : "—"}
              </span>
              {priceCount > 1 && (
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {priceCount} prix
                </span>
              )}
            </div>
          );
        },
        meta: { label: "Prix HT" },
      },
      {
        // Dernier achat : c'est ce qui fait remonter un produit rachete
        // aujourd'hui, sans effacer les achats precedents (visibles au detail).
        id: "lastPurchase",
        accessorFn: (row) =>
          (row as unknown as { last_purchase_at?: string }).last_purchase_at ?? "",
        header: ({ column }) => <SortHeader label="Dernier achat" column={column} />,
        cell: ({ row }) => {
          const at = (row.original as unknown as { last_purchase_at?: string | null })
            .last_purchase_at;
          if (!at) return <span className="text-muted-foreground">—</span>;
          const d = new Date(at);
          return (
            <div className="leading-tight">
              <span className="text-[15px] tabular-nums">
                {d.toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </span>
            </div>
          );
        },
        meta: { label: "Dernier achat" },
      },
      {
        id: "entries",
        accessorFn: (row) => {
          const data = entryQtyByProduct?.[row.id];
          if (!data) return 0;
          return Object.values(data).reduce((sum, d) => sum + d.qty, 0);
        },
        header: ({ column }) => <SortHeader label={`Entrées ${currentYear}`} column={column} />,
        cell: ({ row }) => {
          const data = entryQtyByProduct?.[row.original.id];
          const total = data ? Object.values(data).reduce((sum, d) => sum + d.qty, 0) : 0;

          if (total === 0) {
            return <span className="text-muted-foreground">—</span>;
          }

          return (
            <span className="font-heading font-bold tabular-nums text-xl text-foreground">
              {total}
            </span>
          );
        },
        sortingFn: "basic",
        meta: { label: `Entrées ${currentYear}` },
      },
      {
        id: "organization",
        accessorFn: (row) => {
          const data = entryQtyByProduct?.[row.id];
          if (!data) return "";
          const orgIds = Object.keys(data);
          return orgIds.map((id) => orgNameById.get(id) ?? id).join(", ");
        },
        header: ({ column }) => <SortHeader label="Entreprise" column={column} />,
        cell: ({ row }) => {
          const data = entryQtyByProduct?.[row.original.id];
          if (!data) return <span className="text-muted-foreground">—</span>;
          const orgIds = Object.keys(data);

          if (orgIds.length === 1) {
            return <span className="text-[15px]">{orgNameById.get(orgIds[0]) ?? orgIds[0]}</span>;
          }

          return <span className="text-[15px]">{orgIds.length} entreprises</span>;
        },
        meta: { label: "Entreprise" },
      },
      {
        id: "supplier",
        accessorFn: (row) => {
          const data = entryQtyByProduct?.[row.id];
          const names = new Set<string>();
          if (data)
            Object.values(data).forEach((d) => d.suppliers.forEach((s) => names.add(s.name)));
          if (names.size === 0 && row.supplier?.name) names.add(row.supplier.name);
          return Array.from(names).join(", ");
        },
        header: ({ column }) => <SortHeader label="Fournisseur" column={column} />,
        cell: ({ row }) => {
          const data = entryQtyByProduct?.[row.original.id];
          const names = new Set<string>();
          if (data)
            Object.values(data).forEach((d) => d.suppliers.forEach((s) => names.add(s.name)));
          if (names.size === 0 && row.original.supplier?.name)
            names.add(row.original.supplier.name);
          const list = Array.from(names);

          if (list.length === 0) return <span className="text-muted-foreground">—</span>;
          if (list.length === 1) return <span className="text-[15px]">{list[0]}</span>;
          return <span className="text-[15px]">{list.length} fournisseurs</span>;
        },
        meta: { label: "Fournisseur" },
      },
      {
        id: "totalValue",
        accessorFn: (row) => {
          const data = entryQtyByProduct?.[row.id];
          if (!data) return 0;
          return Object.values(data).reduce(
            (s, d) => s + d.byPrice.reduce((ps, bp) => ps + bp.unitPrice * bp.qty, 0),
            0
          );
        },
        header: ({ column }) => <SortHeader label="Valeur achats HT" column={column} />,
        cell: ({ row }) => {
          const data = entryQtyByProduct?.[row.original.id];
          if (!data) return <span className="text-muted-foreground">—</span>;
          const value = Object.values(data).reduce(
            (s, d) => s + d.byPrice.reduce((ps, bp) => ps + bp.unitPrice * bp.qty, 0),
            0
          );
          if (value === 0) return <span className="text-muted-foreground">—</span>;
          // Pas de barre pour l'outillage : elle exprime une part dans le total
          // des achats, dont il est justement exclu. La montrer laisserait
          // croire qu'il y contribue.
          const isEquipment = row.original.product_type === "equipment";
          const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
          return (
            <div className="flex flex-col items-end gap-1 min-w-[80px]">
              <span
                className={cn(
                  "font-heading tabular-nums text-[15px] font-semibold leading-none",
                  isEquipment ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
              </span>
              {!isEquipment && (
                <div className="w-full h-1 rounded-full bg-foreground/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-foreground/20"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        },
        sortingFn: "basic",
        meta: { label: "Valeur achats HT", align: "right" },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entryQtyByProduct, expandedRows, currentYear]
  );

  const table = useReactTable({
    data: products,
    columns,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting, columnVisibility },
  });

  if (isLoading || isEntriesLoading || isOrgLoading || !currentOrganization) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full rounded-md" />
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="h-11 pl-4 pr-0 w-10" />
                <th className="h-11 px-5 text-left">
                  <Skeleton className="h-3 w-16" />
                </th>
                <th className="h-11 px-5 text-left">
                  <Skeleton className="h-3 w-12" />
                </th>
                <th className="h-11 px-5 text-left">
                  <Skeleton className="h-3 w-16" />
                </th>
                <th className="h-11 px-5 text-left">
                  <Skeleton className="h-3 w-16" />
                </th>
                <th className="h-11 px-5 text-left">
                  <Skeleton className="h-3 w-16" />
                </th>
              </tr>
            </thead>
            <tbody>
              {[...Array(8)].map((_, i) => (
                <tr key={i} className="border-b last:border-b-0">
                  <td className="pl-4 pr-0 w-10" />
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-4">
                      <Skeleton className="size-10 rounded-lg" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <Skeleton className="h-4 w-16" />
                  </td>
                  <td className="px-5 py-4">
                    <Skeleton className="h-5 w-8" />
                  </td>
                  <td className="px-5 py-4">
                    <Skeleton className="h-4 w-16" />
                  </td>
                  <td className="px-5 py-4">
                    <Skeleton className="h-4 w-16" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search + filters on same line */}
      <div className="flex items-center gap-2">
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Rechercher un produit..."
          className="bg-white dark:bg-card"
          wrapperClassName="flex-1 min-w-0"
        />

        {(userOrgs?.length ?? 0) > 1 && (
          <Popover>
            <PopoverTrigger
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all select-none cursor-pointer",
                filterOrgs.size > 0
                  ? "bg-primary text-primary-foreground"
                  : "bg-foreground/[0.06] text-foreground/70 hover:bg-foreground/[0.10]"
              )}
            >
              <Building2 className="size-3" />
              Societe
              {filterOrgs.size > 0 && (
                <>
                  <span className="opacity-80 tabular-nums font-heading">{filterOrgs.size}</span>
                  <span
                    role="button"
                    className="ml-0.5 rounded-full hover:bg-white/20 p-0.5 -mr-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      startTransition(() => setFilterOrgs(new Set()));
                    }}
                  >
                    <X className="size-3" />
                  </span>
                </>
              )}
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-auto min-w-[180px] p-1 rounded-xl overflow-hidden"
            >
              <div className="flex flex-col gap-0.5 max-h-[280px] overflow-y-auto">
                {userOrgs?.map((org) => {
                  const selected = filterOrgs.has(org.id);
                  return (
                    <button
                      key={org.id}
                      type="button"
                      className={cn(
                        "flex items-center gap-2 text-[13px] px-3 py-1.5 rounded-lg transition-colors",
                        selected
                          ? "bg-primary/10 text-foreground font-medium"
                          : "text-foreground/70 hover:bg-muted hover:text-foreground"
                      )}
                      onClick={() =>
                        startTransition(() => setFilterOrgs((prev) => toggleSet(prev, org.id)))
                      }
                    >
                      <span
                        className={cn(
                          "size-3.5 flex items-center justify-center",
                          !selected && "opacity-0"
                        )}
                      >
                        <Check className="size-3.5" />
                      </span>
                      {org.name}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}

        <TableColumnToggle table={table} />
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b">
                {headerGroup.headers.map((header) => {
                  const align = (header.column.columnDef.meta as { align?: string })?.align;
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "h-11 font-medium whitespace-nowrap",
                        header.column.id === "expand" ? "pl-4 pr-0 w-10" : "px-5",
                        align === "right" && "text-right",
                        align === "center" && "text-center",
                        !align && "text-left"
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows?.length ? (
              table
                .getRowModel()
                .rows.map((row) => {
                  const productId = row.original.id;
                  // Un outil n'a pas de fiche produit : celle-ci parle de seuil
                  // critique et de reapprovisionnement, notions qui ne
                  // s'appliquent pas. On renvoie vers sa page.
                  const isEquipment = row.original.product_type === "equipment";
                  return (
                    <tr
                      key={productId}
                      className="group border-b last:border-b-0 transition-colors hover:bg-muted/60 cursor-pointer"
                      onClick={() =>
                        router.push(
                          isEquipment ? `/outillage?outil=${productId}` : `/produits/${productId}`
                        )
                      }
                    >
                      {row.getVisibleCells().map((cell) => {
                        const meta = cell.column.columnDef.meta as
                          | { align?: string; width?: string }
                          | undefined;
                        const align = meta?.align;
                        const isExpandCol = cell.column.id === "expand";
                        return (
                          <td
                            key={cell.id}
                            className={cn(
                              "py-4 whitespace-nowrap",
                              isExpandCol ? "pl-4 pr-0 w-10" : "px-5",
                              align === "right" && "text-right",
                              align === "center" && "text-center"
                            )}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
                .flatMap((rowEl, i) => {
                  const row = table.getRowModel().rows[i];
                  const productId = row.original.id;
                  const isExpanded = expandedRows.has(productId);
                  const entryData = entryQtyByProduct?.[productId];
                  const showDetail =
                    isExpanded &&
                    entryData &&
                    (Object.keys(entryData).length > 1 ||
                      Object.values(entryData).some(
                        (d) => d.byPrice.length > 1 || d.suppliers.length > 1
                      ));

                  if (!showDetail) return [rowEl];

                  return [
                    rowEl,
                    <OrgDetailCards
                      key={`detail-${productId}`}
                      productId={productId}
                      entryData={entryData}
                      orgNameById={orgNameById}
                    />,
                  ];
                })
            ) : (
              <tr>
                <td colSpan={columns.length}>
                  <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                    <div className="flex size-16 items-center justify-center rounded-2xl bg-muted mb-4">
                      <Package className="size-7 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold">Aucun produit</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                      {debouncedSearch || filterOrgs.size > 0
                        ? "Aucun produit ne correspond à cette recherche."
                        : "Aucun achat enregistré cette année."}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pied : produits achetes, et total consommables.
           L'outillage figure dans le tableau mais reste hors du total, par
           regle metier. */}
      {products.length > 0 && (
        <p className="text-muted-foreground text-sm px-1">
          <span className="font-heading font-semibold text-foreground tabular-nums">
            {table.getRowModel().rows.length}
          </span>
          {table.getRowModel().rows.length !== purchases.length && (
            <span className="tabular-nums"> sur {purchases.length}</span>
          )}{" "}
          produit{purchases.length > 1 ? "s" : ""} acheté{purchases.length > 1 ? "s" : ""} en{" "}
          {currentYear}
          {" · "}
          <span className="font-heading font-semibold text-foreground tabular-nums">
            {purchases
              .filter((p) => p.product_type === "consumable")
              .reduce((s, p) => s + p.totalValue, 0)
              .toLocaleString("fr-FR", {
                style: "currency",
                currency: "EUR",
                maximumFractionDigits: 0,
              })}
          </span>{" "}
          hors outillage
        </p>
      )}
    </div>
  );
}
