"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryStates, parseAsString } from "nuqs";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowDownToLine, ArrowUpFromLine, Search, History } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  StockMovement,
  MovementType,
  MOVEMENT_TYPE_LABELS,
} from "@/lib/supabase/queries/stock-movements";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useStockMovements } from "@/hooks/queries";
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

// ─── Type filter chips ──────────────────────────────────────
const TYPE_FILTER_OPTIONS = [
  { value: "all", label: "Tous" },
  { value: "entry", label: "Entrées" },
  { value: "exit_technician", label: "Technicien" },
  { value: "exit_anonymous", label: "Anonyme" },
  { value: "exit_loss", label: "Perte" },
];

// ─── Main component ────────────────────────────────────────
export default function MovementsList() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();
  const [sorting, setSorting] = useState<SortingState>([]);

  const [filters, setFilters] = useQueryStates({
    type: parseAsString.withDefault("all"),
    search: parseAsString.withDefault(""),
  });

  const filterType = filters.type;
  const searchQuery = filters.search;

  const setFilterType = (value: string) => setFilters({ type: value });
  const setSearchQuery = (value: string) => setFilters({ search: value });

  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);

  const { data: movementsResult, isLoading } = useStockMovements({
    organizationId: currentOrganization?.id,
    movementType: filterType !== "all" ? (filterType as MovementType) : undefined,
  });

  const movements = movementsResult?.movements || [];

  // Client-side search within current page
  const filteredMovements = debouncedSearch
    ? movements.filter((m) => {
        const q = debouncedSearch.toLowerCase();
        const productName = m.product?.name?.toLowerCase() || "";
        const techName = m.technician
          ? `${m.technician.first_name} ${m.technician.last_name}`.toLowerCase()
          : "";
        return productName.includes(q) || techName.includes(q);
      })
    : movements;

  const handleRowClick = (movement: StockMovement) => {
    if (movement.movement_type === "entry") {
      router.push(`/orders/income/${movement.id}`);
    } else {
      router.push(`/orders/outcome/${movement.id}`);
    }
  };

  const columns: ColumnDef<StockMovement>[] = [
    {
      accessorKey: "created_at",
      header: ({ column }) => <SortHeader label="Date" column={column} />,
      cell: ({ row }) => {
        const date = new Date(row.original.created_at ?? Date.now());
        return (
          <div>
            <div className="text-[15px]">{format(date, "dd MMM yyyy", { locale: fr })}</div>
            <div className="text-xs text-muted-foreground">
              {format(date, "HH:mm", { locale: fr })}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "movement_type",
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
          Type
        </span>
      ),
      enableSorting: false,
      cell: ({ row }) => {
        const type = row.original.movement_type;
        const isEntry = type === "entry";
        return (
          <div className="flex items-center gap-2">
            {isEntry ? (
              <ArrowDownToLine className="size-3.5 text-standard" />
            ) : (
              <ArrowUpFromLine className="size-3.5 text-critique" />
            )}
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[13px] font-medium",
                type === "entry" && "text-standard bg-standard-bg",
                type === "exit_technician" && "text-foreground/80 bg-muted",
                type === "exit_anonymous" && "text-attention bg-attention-bg",
                type === "exit_loss" && "text-critique bg-critique-bg"
              )}
            >
              {MOVEMENT_TYPE_LABELS[type]}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "product",
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
          Produit
        </span>
      ),
      enableSorting: false,
      cell: ({ row }) => {
        const product = row.original.product;
        return (
          <div className="flex items-center gap-4">
            <ProductIconDisplay imageUrl={product?.image_url} size="md" />
            <div className="min-w-0">
              <div className="font-semibold text-[15px] leading-tight">
                {product?.name || "Produit inconnu"}
              </div>
              {product?.sku && (
                <div className="text-xs text-muted-foreground mt-0.5 font-mono">{product.sku}</div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "quantity",
      header: ({ column }) => (
        <SortHeader label="Qté" column={column} className="justify-center w-full" />
      ),
      cell: ({ row }) => {
        const isEntry = row.original.movement_type === "entry";
        return (
          <span
            className={cn(
              "font-heading font-bold tabular-nums text-xl",
              isEntry ? "text-standard" : "text-critique"
            )}
          >
            {isEntry ? "+" : "−"}
            {row.original.quantity}
          </span>
        );
      },
      meta: { align: "center" },
    },
    {
      accessorKey: "technician",
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
          Technicien
        </span>
      ),
      enableSorting: false,
      cell: ({ row }) => {
        const technician = row.original.technician;
        if (!technician) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="text-[15px]">
            {technician.first_name} {technician.last_name}
          </span>
        );
      },
    },
    {
      accessorKey: "notes",
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
          Notes
        </span>
      ),
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
          {row.original.notes || "—"}
        </span>
      ),
    },
  ];

  const table = useReactTable({
    data: filteredMovements,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
  });

  if ((isLoading || isOrgLoading) && movements.length === 0) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full rounded-md" />
        <div className="flex gap-1.5">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="h-11 px-5 text-left">
                  <Skeleton className="h-3 w-10" />
                </th>
                <th className="h-11 px-5 text-left">
                  <Skeleton className="h-3 w-12" />
                </th>
                <th className="h-11 px-5 text-left">
                  <Skeleton className="h-3 w-14" />
                </th>
                <th className="h-11 px-5 text-center">
                  <Skeleton className="h-3 w-8 mx-auto" />
                </th>
                <th className="h-11 px-5 text-left">
                  <Skeleton className="h-3 w-18" />
                </th>
                <th className="h-11 px-5 text-left">
                  <Skeleton className="h-3 w-10" />
                </th>
              </tr>
            </thead>
            <tbody>
              {[...Array(8)].map((_, i) => (
                <tr key={i} className="border-b last:border-b-0">
                  <td className="px-5 py-4">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-3 w-10" />
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Skeleton className="size-3.5 rounded" />
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-4">
                      <Skeleton className="size-10 rounded-lg" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <Skeleton className="h-5 w-8 mx-auto" />
                  </td>
                  <td className="px-5 py-4">
                    <Skeleton className="h-4 w-24" />
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
      {/* Search + type chips */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un mouvement..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white dark:bg-card"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TYPE_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                setFilterType(filterType === opt.value && opt.value !== "all" ? "all" : opt.value)
              }
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                filterType === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-foreground/[0.06] text-foreground/70 hover:bg-foreground/[0.10]"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
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

          <tbody>
            <AnimatePresence mode="popLayout" initial={false}>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row, index) => (
                  <AnimatedRow
                    key={row.original.id}
                    index={index}
                    reducedMotion={prefersReducedMotion}
                    onClick={() => handleRowClick(row.original)}
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
                  <td colSpan={columns.length}>
                    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted mb-4">
                        <History className="size-7 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">Aucun mouvement</h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                        {searchQuery || filterType !== "all"
                          ? "Aucun mouvement ne correspond à ces filtres."
                          : "Les mouvements de stock apparaîtront ici."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      {movements.length > 0 && (
        <p className="text-muted-foreground text-sm px-1">
          <span className="font-heading font-semibold text-foreground tabular-nums">
            {filteredMovements.length}
          </span>
          {filteredMovements.length !== movements.length && (
            <span className="tabular-nums"> sur {movements.length}</span>
          )}{" "}
          mouvement{movements.length > 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
