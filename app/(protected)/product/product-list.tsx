"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryStates, parseAsString } from "nuqs";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Search, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import QuickStockMovementModal from "@/components/quick-stock-movement-modal";

import { ProductWithCategory } from "@/lib/supabase/queries/products";
import { calculateStockScore, getStockScoreColor, getStockBadgeVariant } from "@/lib/utils/stock";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useProducts, useCategories } from "@/hooks/queries";
import ProductIconDisplay from "@/components/product-icon-display";
import { cn } from "@/lib/utils";

// ─── Animated table row ────────────────────────────────────
const MotionTr = motion.create("tr");

function AnimatedRow({
  children,
  index,
  reducedMotion,
  onClick,
}: {
  children: React.ReactNode;
  index: number;
  reducedMotion: boolean | null;
  onClick?: () => void;
}) {
  return (
    <MotionTr
      layout={!reducedMotion}
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
      transition={{
        type: "spring",
        bounce: 0,
        duration: 0.35,
        delay: reducedMotion ? 0 : index * 0.03,
      }}
      className="group border-b last:border-b-0 transition-colors hover:bg-muted/60 cursor-pointer"
      onClick={onClick}
    >
      {children}
    </MotionTr>
  );
}

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
  const prefersReducedMotion = useReducedMotion();
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filters, setFilters] = useQueryStates({
    search: parseAsString.withDefault(""),
    category: parseAsString.withDefault(""),
  });

  // Stock movement modal state
  const [modalProductId, setModalProductId] = useState<string | null>(null);
  const [modalDirection, setModalDirection] = useState<"entry" | "exit">("entry");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openMovementModal = (productId: string, direction: "entry" | "exit") => {
    setModalProductId(productId);
    setModalDirection(direction);
    setIsModalOpen(true);
  };

  const searchQuery = filters.search;
  const categoryFilter = filters.category;
  const setSearchQuery = (value: string) => setFilters({ search: value });
  const setCategoryFilter = (value: string) => setFilters({ category: value });

  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);

  const { data: categories = [] } = useCategories(currentOrganization?.id);

  const { data: productsResult, isLoading } = useProducts({
    organizationId: currentOrganization?.id,
    search: debouncedSearch || undefined,
    categoryId: categoryFilter || undefined,
  });

  const products = productsResult?.products || [];

  const columns: ColumnDef<ProductWithCategory>[] = [
    {
      accessorKey: "name",
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
      accessorKey: "price",
      header: ({ column }) => (
        <SortHeader label="Prix HT" column={column} className="justify-end w-full" />
      ),
      cell: ({ row }) => {
        const price = row.original.price;
        return (
          <span className="font-heading tabular-nums text-[15px] text-foreground">
            {price ? price.toLocaleString("fr-FR", { style: "currency", currency: "EUR" }) : "—"}
          </span>
        );
      },
      meta: { align: "right" },
    },
    {
      accessorKey: "stock_current",
      header: ({ column }) => (
        <SortHeader label="Stock" column={column} className="justify-center w-full" />
      ),
      cell: ({ row }) => {
        const product = row.original;
        const score = calculateStockScore(product.stock_current, product.stock_min);
        return (
          <span
            className={cn("font-heading font-bold tabular-nums text-xl", getStockScoreColor(score))}
          >
            {product.stock_current ?? 0}
          </span>
        );
      },
      meta: { align: "center" },
    },
    {
      id: "status",
      accessorFn: (row) => calculateStockScore(row.stock_current, row.stock_min),
      header: ({ column }) => (
        <SortHeader label="Statut" column={column} className="justify-end w-full" />
      ),
      cell: ({ row }) => {
        const product = row.original;
        const score = calculateStockScore(product.stock_current, product.stock_min);
        const status = getStockBadgeVariant(score);
        return <StatusPill status={status} />;
      },
      sortingFn: "basic",
      meta: { align: "right" },
    },
    {
      id: "actions",
      header: () => null,
      cell: ({ row }) => {
        const product = row.original;
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                openMovementModal(product.id, "exit");
              }}
            >
              <ArrowUpFromLine className="size-3.5" />
              Sortir
            </Button>
            <Button
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                openMovementModal(product.id, "entry");
              }}
            >
              <ArrowDownToLine className="size-3.5" />
              Entrer
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
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
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
                <th className="h-11 px-5 text-right">
                  <Skeleton className="h-3 w-12 ml-auto" />
                </th>
                <th className="h-11 px-5 text-center">
                  <Skeleton className="h-3 w-10 mx-auto" />
                </th>
                <th className="h-11 px-5 text-right">
                  <Skeleton className="h-3 w-12 ml-auto" />
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
                  <td className="px-5 py-4 text-right">
                    <Skeleton className="h-4 w-16 ml-auto" />
                  </td>
                  <td className="px-5 py-4 text-center">
                    <Skeleton className="h-5 w-8 mx-auto" />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Skeleton className="h-6 w-16 rounded-full ml-auto" />
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

  return (
    <div className="space-y-3">
      {/* Search + category filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un produit..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white dark:bg-card"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCategoryFilter("")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                !categoryFilter
                  ? "bg-primary text-primary-foreground"
                  : "bg-foreground/[0.06] text-foreground/70 hover:bg-foreground/[0.10]"
              )}
            >
              Tout
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(categoryFilter === cat.id ? "" : cat.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  categoryFilter === cat.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-foreground/[0.06] text-foreground/70 hover:bg-foreground/[0.10]"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
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
            <AnimatePresence mode="popLayout" initial={false}>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row, index) => (
                  <AnimatedRow
                    key={row.original.id}
                    index={index}
                    reducedMotion={prefersReducedMotion}
                    onClick={() => router.push(`/product/${row.original.id}`)}
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
                  </AnimatedRow>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="h-32 text-center">
                    <div className="text-muted-foreground">
                      Aucun produit trouvé.{" "}
                      <Link href="/product/create" className="text-primary hover:underline">
                        Créer un produit
                      </Link>
                    </div>
                  </td>
                </tr>
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Stock movement modal */}
      <QuickStockMovementModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setModalProductId(null);
        }}
        productId={modalProductId}
        defaultDirection={modalDirection}
      />
    </div>
  );
}
