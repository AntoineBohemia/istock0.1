"use client";

import { useMemo, useState } from "react";
import { useQueryStates, parseAsString } from "nuqs";
import { useDebouncedValue } from "@/hooks/use-debounce";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  Building2,
  Tag,
  Check,
  X,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/search-input";
import { QueryError } from "@/components/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import StockEntryModal from "@/components/stock-entry-modal";
import StockExitModal from "@/components/stock-exit-modal";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import ReorderRecapModal, { computeReorderList } from "@/components/reorder-recap-modal";
import ExportStockPopover from "./export-stock-popover";

import { ProductWithRelations } from "@/lib/supabase/queries/products";
import { calculateStockScore, getStockScoreColor, getStockBadgeVariant } from "@/lib/utils/stock";
import { StatusPill } from "@/components/ui/status-pill";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useProducts, useCategories, useOrganizations } from "@/hooks/queries";
import ProductIconDisplay from "@/components/product-icon-display";
import { TableColumnToggle } from "@/components/table-column-toggle";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { cn } from "@/lib/utils";

const fmtPrice = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

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

// ─── Main component ────────────────────────────────────────
export default function ProductList() {
  const router = useRouter();
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filters, setFilters] = useQueryStates({
    search: parseAsString.withDefault(""),
  });

  // Stock movement modal state
  const [entryProductId, setEntryProductId] = useState<string | null>(null);
  const [exitProductId, setExitProductId] = useState<string | null>(null);
  const [reorderOpen, setReorderOpen] = useState(false);

  // Multi-select filters
  const [filterCategories, setFilterCategories] = useState<Set<string>>(new Set());
  const [filterOrgs, setFilterOrgs] = useState<Set<string>>(new Set());

  const searchQuery = filters.search;
  const setSearchQuery = (value: string) => setFilters({ search: value });

  const toggleSet = (prev: Set<string>, value: string) => {
    const next = new Set(prev);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  const { data: categories = [] } = useCategories(currentOrganization?.id);
  const { data: userOrgs } = useOrganizations();
  const isMultiOrg = (userOrgs?.length ?? 0) > 1;

  const {
    data: productsResult,
    isLoading,
    isError,
    refetch,
  } = useProducts({
    organizationId: currentOrganization?.id,
    search: debouncedSearch || undefined,
  });

  const allProducts = productsResult?.products || [];

  // Client-side multi-select filtering
  const products = useMemo(() => {
    let result = allProducts;
    if (filterCategories.size > 0) {
      result = result.filter((p) => p.category_id && filterCategories.has(p.category_id));
    }
    if (filterOrgs.size > 0) {
      result = result.filter((p) =>
        p.product_organization_stock?.some(
          (pos) => filterOrgs.has(pos.organization_id) && pos.stock_current > 0
        )
      );
    }
    return result;
  }, [allProducts, filterCategories, filterOrgs]);

  const [columnVisibility, setColumnVisibility] = useColumnVisibility("produits");

  // Reorder computation — products at or below stock_min
  const reorderItems = useMemo(() => computeReorderList(allProducts), [allProducts]);
  const reorderCount = reorderItems.length;

  // Micro-bars are now per-product relative to their own threshold (not global max)

  const columns: ColumnDef<ProductWithRelations>[] = [
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
              <div className="font-semibold text-[15px] leading-tight">{product.name}</div>
              {product.sku && (
                <div className="text-xs text-muted-foreground mt-0.5 font-mono">{product.sku}</div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "stock_current",
      header: ({ column }) => <SortHeader label="Stock" column={column} />,
      cell: ({ row }) => {
        const product = row.original;

        // If org filter is active, show that org's stock
        const singleOrg = filterOrgs.size === 1 ? [...filterOrgs][0] : null;
        const displayStock = singleOrg
          ? (product.product_organization_stock?.find((pos) => pos.organization_id === singleOrg)
              ?.stock_current ?? 0)
          : (product.stock_current ?? 0);

        const score = calculateStockScore(displayStock, product.stock_min);
        const min = product.stock_min ?? 10;
        const target = min * 2;
        const pct = target > 0 ? Math.min(100, (displayStock / target) * 100) : 0;
        return (
          <div className="flex flex-col items-start gap-1 min-w-[60px]">
            <span
              className={cn(
                "font-heading font-bold tabular-nums text-xl leading-none",
                getStockScoreColor(score)
              )}
            >
              {displayStock}
            </span>
            {displayStock > 0 && (
              <div className="w-full h-1 rounded-full bg-foreground/[0.06] overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    score < 1
                      ? "bg-critique/40"
                      : score < 60
                        ? "bg-attention/40"
                        : "bg-foreground/20"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
            {isMultiOrg && !singleOrg && (
              <p className="text-[10px] text-muted-foreground tabular-nums">
                {(userOrgs ?? [])
                  .map((org) => {
                    const qty =
                      product.product_organization_stock?.find(
                        (pos) => pos.organization_id === org.id
                      )?.stock_current ?? 0;
                    return `${org.name}: ${qty}`;
                  })
                  .join(" · ")}
              </p>
            )}
          </div>
        );
      },
      meta: { label: "Stock" },
    },
    {
      accessorKey: "price",
      header: ({ column }) => <SortHeader label="Prix HT" column={column} />,
      cell: ({ row }) => {
        const price = row.original.price;
        if (price == null) return <span className="text-muted-foreground">—</span>;
        return <span className="text-[15px] tabular-nums">{fmtPrice(price)}</span>;
      },
      meta: { label: "Prix HT" },
    },
    {
      id: "category",
      accessorFn: (row) => row.category?.name ?? "",
      header: ({ column }) => <SortHeader label="Catégorie" column={column} />,
      cell: ({ row }) => {
        const category = row.original.category;
        if (!category) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="inline-flex items-center rounded-md bg-foreground/[0.06] px-2 py-0.5 text-xs font-medium">
            {category.name}
          </span>
        );
      },
      meta: { label: "Catégorie" },
    },
    {
      id: "supplier",
      accessorFn: (row) => row.supplier?.name ?? "",
      header: ({ column }) => <SortHeader label="Fournisseur" column={column} />,
      cell: ({ row }) => {
        const supplier = row.original.supplier;
        if (!supplier) return <span className="text-muted-foreground">—</span>;
        return <span className="text-sm">{supplier.name}</span>;
      },
      meta: { label: "Fournisseur" },
    },
    {
      id: "status",
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
          Statut
        </span>
      ),
      cell: ({ row }) => {
        const product = row.original;
        const score = calculateStockScore(product.stock_current, product.stock_min);
        return <StatusPill status={getStockBadgeVariant(score)} />;
      },
      meta: { label: "Statut" },
    },
    {
      id: "actions",
      enableHiding: false,
      header: () => null,
      cell: ({ row }) => {
        const product = row.original;
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setEntryProductId(product.id);
              }}
            >
              <ArrowDownToLine className="size-3.5" />
              Entrer en stock
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setExitProductId(product.id);
              }}
            >
              <ArrowUpFromLine className="size-3.5" />
              Sortie de stock
            </Button>
          </div>
        );
      },
      meta: { align: "right" },
    },
  ];

  const table = useReactTable({
    data: products,
    columns,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting, columnVisibility },
  });

  if (isLoading || isOrgLoading || !currentOrganization) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full rounded-md" />
        <div className="flex gap-1.5">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="h-11 px-5 text-left">
                  <Skeleton className="h-3 w-16" />
                </th>
                <th className="h-11 px-5 text-left">
                  <Skeleton className="h-3 w-10" />
                </th>
                <th className="h-11 px-5 text-left">
                  <Skeleton className="h-3 w-12" />
                </th>
                <th className="h-11 px-5" />
              </tr>
            </thead>
            <tbody>
              {[...Array(8)].map((_, i) => (
                <tr key={i} className="border-b last:border-b-0">
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
                    <Skeleton className="h-5 w-8" />
                  </td>
                  <td className="px-5 py-4">
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </td>
                  <td className="px-5 py-4" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (isError) {
    return <QueryError message="Impossible de charger les produits." onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Stock produits</h1>
        <div className="flex items-center gap-2">
          <ExportStockPopover
            organizationId={currentOrganization.id}
            organizations={userOrgs}
            isMultiOrg={isMultiOrg}
          />
          {reorderCount > 0 && (
            <Button variant="outline" onClick={() => setReorderOpen(true)}>
              A commander
              <span className="inline-flex items-center justify-center size-5 rounded-full bg-attention text-white text-[11px] font-bold font-heading leading-none">
                {reorderCount}
              </span>
            </Button>
          )}
          <Button variant="outline-contrast" asChild>
            <Link href="/produits/nouveau">
              <Plus /> Ajouter un produit
            </Link>
          </Button>
        </div>
      </div>

      {/* Filtres mis en avant ; recherche volontairement compacte */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Rechercher…"
          className="bg-white dark:bg-card h-9"
          wrapperClassName="w-full sm:w-52 shrink-0"
        />

        <div className="flex items-center gap-2 flex-wrap">
          {isMultiOrg && (
            <Popover>
              <PopoverTrigger
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full h-9 px-4 text-[13px] font-semibold transition-all select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.97]",
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
                        setFilterOrgs(new Set());
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
                        onClick={() => setFilterOrgs((prev) => toggleSet(prev, org.id))}
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

          {categories.length > 0 && (
            <Popover>
              <PopoverTrigger
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full h-9 px-4 text-[13px] font-semibold transition-all select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.97]",
                  filterCategories.size > 0
                    ? "bg-primary text-primary-foreground"
                    : "bg-foreground/[0.06] text-foreground/70 hover:bg-foreground/[0.10]"
                )}
              >
                <Tag className="size-3" />
                Categorie
                {filterCategories.size > 0 && (
                  <>
                    <span className="opacity-80 tabular-nums font-heading">
                      {filterCategories.size}
                    </span>
                    <span
                      role="button"
                      className="ml-0.5 rounded-full hover:bg-white/20 p-0.5 -mr-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFilterCategories(new Set());
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
                  {categories.map((cat) => {
                    const selected = filterCategories.has(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        className={cn(
                          "flex items-center gap-2 text-[13px] px-3 py-1.5 rounded-lg transition-colors",
                          selected
                            ? "bg-primary/10 text-foreground font-medium"
                            : "text-foreground/70 hover:bg-muted hover:text-foreground"
                        )}
                        onClick={() => setFilterCategories((prev) => toggleSet(prev, cat.id))}
                      >
                        <span
                          className={cn(
                            "size-3.5 flex items-center justify-center",
                            !selected && "opacity-0"
                          )}
                        >
                          <Check className="size-3.5" />
                        </span>
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        <div className="ml-auto shrink-0">
          <TableColumnToggle table={table} />
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full">
          {/* Header */}
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b">
                {headerGroup.headers.map((header) => {
                  const align = (header.column.columnDef.meta as { align?: string })?.align;
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "h-11 px-5 font-medium whitespace-nowrap",
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

          {/* Body */}
          <tbody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.original.id}
                  className="group border-b last:border-b-0 transition-colors hover:bg-muted/60 cursor-pointer"
                  onClick={() => router.push(`/produits/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => {
                    const align = (cell.column.columnDef.meta as { align?: string })?.align;
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-5 py-4 whitespace-nowrap",
                          align === "right" && "text-right",
                          align === "center" && "text-center"
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length}>
                  <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                    <div className="flex size-16 items-center justify-center rounded-2xl bg-muted mb-4">
                      <Package className="size-7 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold">Aucun produit</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                      {searchQuery || filterCategories.size > 0 || filterOrgs.size > 0
                        ? "Aucun produit ne correspond à cette recherche."
                        : "Ajoutez vos produits pour commencer à gérer votre stock."}
                    </p>
                    {!searchQuery && filterCategories.size === 0 && filterOrgs.size === 0 && (
                      <Button asChild className="mt-5">
                        <Link href="/produits/nouveau">Ajouter un produit</Link>
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      {products.length > 0 && (
        <p className="text-muted-foreground text-sm px-1">
          <span className="font-heading font-semibold text-foreground tabular-nums">
            {table.getRowModel().rows.length}
          </span>
          {productsResult && table.getRowModel().rows.length !== productsResult.total && (
            <span className="tabular-nums"> sur {productsResult.total}</span>
          )}{" "}
          produit{(productsResult?.total ?? 0) > 1 ? "s" : ""}
        </p>
      )}

      <StockEntryModal
        open={!!entryProductId}
        onClose={() => setEntryProductId(null)}
        productId={entryProductId}
      />
      <StockExitModal
        open={!!exitProductId}
        onClose={() => setExitProductId(null)}
        productId={exitProductId}
      />
      <ReorderRecapModal
        open={reorderOpen}
        onClose={() => setReorderOpen(false)}
        products={allProducts}
      />
    </div>
  );
}
