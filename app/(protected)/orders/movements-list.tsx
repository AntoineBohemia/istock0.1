"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  ArrowUpDown,
  ArrowDownToLine,
  ArrowUpFromLine,
  Search,
  History,
  CalendarDays,
  X,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  format,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  subMonths,
  subYears,
  isWithinInterval,
  startOfDay,
  endOfDay,
} from "date-fns";
import { fr } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { HeroNumber } from "@/components/ui/hero-number";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { StockMovement, MOVEMENT_TYPE_LABELS } from "@/lib/supabase/queries/stock-movements";
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
      className="group border-b last:border-b-0 cursor-pointer transition-colors hover:bg-muted/50"
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
const TYPE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "entry", label: "Entrées" },
  { value: "exit_technician", label: "Sortie technicien" },
  { value: "exit_anonymous", label: "Autre" },
];

// ─── Main component ────────────────────────────────────────
export default function MovementsList() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

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

  // Fetch all movements (client-side filtering, like technicians page)
  const { data: movementsResult, isLoading } = useStockMovements({
    organizationId: currentOrganization?.id,
  });

  const allMovements = movementsResult?.movements || [];

  // Count per type for chip badges
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allMovements.length };
    for (const m of allMovements) {
      counts[m.movement_type] = (counts[m.movement_type] || 0) + 1;
    }
    return counts;
  }, [allMovements]);

  // Client-side type + search + date filter
  const filteredMovements = useMemo(() => {
    let result = allMovements;
    if (filterType !== "all") {
      result = result.filter((m) => m.movement_type === filterType);
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((m) => {
        const productName = m.product?.name?.toLowerCase() || "";
        const techName = m.technician
          ? `${m.technician.first_name} ${m.technician.last_name}`.toLowerCase()
          : "";
        return productName.includes(q) || techName.includes(q);
      });
    }
    if (dateRange?.from) {
      const from = startOfDay(dateRange.from);
      const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
      result = result.filter((m) => {
        if (!m.created_at) return false;
        return isWithinInterval(new Date(m.created_at), { start: from, end: to });
      });
    }
    return result;
  }, [allMovements, filterType, debouncedSearch, dateRange]);

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
                type === "exit_anonymous" && "text-attention bg-attention-bg"
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
      id: "supplier",
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
          Société
        </span>
      ),
      enableSorting: false,
      cell: ({ row }) => {
        if (row.original.movement_type !== "entry") {
          return <span className="text-muted-foreground">—</span>;
        }
        const supplier = row.original.supplier;
        if (!supplier) return <span className="text-muted-foreground">—</span>;
        return <span className="text-[15px]">{supplier.name}</span>;
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

  if ((isLoading || isOrgLoading) && allMovements.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Skeleton className="h-9 flex-1 rounded-md" />
          <div className="flex gap-1.5">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-7 w-20 rounded-full" />
            ))}
          </div>
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
                  <td className="px-5 py-4">
                    <Skeleton className="h-4 w-20" />
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

  const totalCount = allMovements.length;

  return (
    <div className="space-y-3">
      {/* Search + date picker + type chips */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un mouvement..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white dark:bg-card"
          />
        </div>

        <Popover
          open={datePickerOpen}
          onOpenChange={(open) => {
            setDatePickerOpen(open);
            if (open) setDraftRange(dateRange);
          }}
        >
          <PopoverTrigger
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all select-none cursor-pointer",
              dateRange?.from
                ? "bg-primary text-primary-foreground"
                : "bg-foreground/[0.06] text-foreground/70 hover:bg-foreground/[0.10]"
            )}
          >
            <CalendarDays className="size-3" />
            {dateRange?.from ? (
              <>
                {dateRange.to
                  ? `${format(dateRange.from, "dd MMM", { locale: fr })} – ${format(dateRange.to, "dd MMM", { locale: fr })}`
                  : format(dateRange.from, "dd MMM yyyy", { locale: fr })}
                <span
                  role="button"
                  className="ml-0.5 rounded-full hover:bg-white/20 p-0.5 -mr-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDateRange(undefined);
                    setDraftRange(undefined);
                  }}
                >
                  <X className="size-3" />
                </span>
              </>
            ) : (
              "Période"
            )}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-0 rounded-xl overflow-hidden">
            <div className="flex">
              {/* Sidebar presets */}
              <div className="border-r py-2 px-2 flex flex-col gap-0.5 min-w-[150px]">
                {[
                  { label: "Aujourd'hui", from: new Date(), to: new Date() },
                  { label: "Hier", from: subDays(new Date(), 1), to: subDays(new Date(), 1) },
                  {
                    label: "Cette semaine",
                    from: startOfWeek(new Date(), { weekStartsOn: 1 }),
                    to: endOfWeek(new Date(), { weekStartsOn: 1 }),
                  },
                  {
                    label: "Semaine dernière",
                    from: startOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 }),
                    to: endOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 }),
                  },
                  { label: "Ce mois", from: startOfMonth(new Date()), to: new Date() },
                  {
                    label: "Mois dernier",
                    from: startOfMonth(subMonths(new Date(), 1)),
                    to: endOfMonth(subMonths(new Date(), 1)),
                  },
                  { label: "Cette année", from: startOfYear(new Date()), to: new Date() },
                  {
                    label: "Année dernière",
                    from: startOfYear(subYears(new Date(), 1)),
                    to: new Date(new Date().getFullYear() - 1, 11, 31),
                  },
                  { label: "Tout", from: undefined, to: undefined },
                ].map((preset) => {
                  const isActive = !preset.from
                    ? !draftRange?.from
                    : draftRange?.from &&
                      draftRange?.to &&
                      format(preset.from, "yyyy-MM-dd") === format(draftRange.from, "yyyy-MM-dd") &&
                      preset.to &&
                      format(preset.to, "yyyy-MM-dd") === format(draftRange.to, "yyyy-MM-dd");
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      className={cn(
                        "text-left text-[13px] px-3 py-1.5 rounded-lg transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "text-foreground/70 hover:bg-muted hover:text-foreground"
                      )}
                      onClick={() => {
                        if (!preset.from) {
                          setDraftRange(undefined);
                          setDateRange(undefined);
                          setDatePickerOpen(false);
                        } else {
                          const range = { from: preset.from, to: preset.to };
                          setDraftRange(range);
                          setDateRange(range);
                          setDatePickerOpen(false);
                        }
                      }}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {/* Calendars */}
              <div className="p-3">
                <Calendar
                  mode="range"
                  selected={draftRange}
                  onSelect={setDraftRange}
                  numberOfMonths={2}
                  locale={fr}
                  fixedWeeks
                  showYearSwitcher={false}
                />

                {/* Footer */}
                <div className="border-t mt-2 pt-3 flex items-center justify-between gap-4">
                  <div className="text-muted-foreground text-[13px]">
                    {draftRange?.from ? (
                      <span className="font-heading tabular-nums">
                        <span className="text-foreground font-semibold">
                          {format(draftRange.from, "dd/MM/yyyy")}
                        </span>
                        {draftRange.to && (
                          <>
                            <span className="mx-2 text-foreground/30">–</span>
                            <span className="text-foreground font-semibold">
                              {format(draftRange.to, "dd/MM/yyyy")}
                            </span>
                          </>
                        )}
                      </span>
                    ) : (
                      "Sélectionnez une période"
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setDraftRange(dateRange);
                        setDatePickerOpen(false);
                      }}
                    >
                      Annuler
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs"
                      disabled={!draftRange?.from}
                      onClick={() => {
                        setDateRange(draftRange);
                        setDatePickerOpen(false);
                      }}
                    >
                      Appliquer
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-1.5">
          {TYPE_FILTER_OPTIONS.map((opt) => {
            const isActive = filterType === opt.value;
            const count = typeCounts[opt.value] || 0;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilterType(isActive && opt.value !== "all" ? "all" : opt.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all select-none",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-foreground/[0.06] text-foreground/70 hover:bg-foreground/[0.10]"
                )}
              >
                {opt.label}
                <span
                  className={cn(
                    "tabular-nums font-heading",
                    isActive ? "opacity-80" : "opacity-50"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
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
                        {searchQuery || filterType !== "all" || dateRange?.from
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

      {/* Footer — animated count */}
      {totalCount > 0 && (
        <div className="px-1">
          <p className="text-muted-foreground text-sm">
            <HeroNumber value={filteredMovements.length} className="text-sm" />
            {filteredMovements.length !== totalCount && (
              <span className="tabular-nums"> sur {totalCount}</span>
            )}{" "}
            mouvement{totalCount > 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
