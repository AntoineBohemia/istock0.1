"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  Building2,
  HardHat,
  Wrench,
  Check,
  X,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
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
import { useStockMovements, useOrganizations } from "@/hooks/queries";
import ProductIconDisplay from "@/components/product-icon-display";
import { cn } from "@/lib/utils";

// ─── Table row — animated on initial mount, plain <tr> after ──
const MotionTr = motion.create("tr");

function AnimatedRow({
  children,
  index,
  reducedMotion,
  isInitial,
  onClick,
}: {
  children: React.ReactNode;
  index: number;
  reducedMotion: boolean | null;
  isInitial: boolean;
  onClick?: () => void;
}) {
  if (!isInitial || reducedMotion) {
    return (
      <tr
        className="group border-b last:border-b-0 cursor-pointer transition-colors hover:bg-muted/50"
        onClick={onClick}
      >
        {children}
      </tr>
    );
  }
  return (
    <MotionTr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        bounce: 0,
        duration: 0.35,
        delay: Math.min(index * 0.03, 0.3),
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

// ─── Date range presets ─────────────────────────────────────
const DATE_PRESETS = [
  { label: "Aujourd'hui", range: () => ({ from: new Date(), to: new Date() }) },
  { label: "Hier", range: () => ({ from: subDays(new Date(), 1), to: subDays(new Date(), 1) }) },
  { separator: true },
  {
    label: "Cette semaine",
    range: () => ({
      from: startOfWeek(new Date(), { weekStartsOn: 1 }),
      to: endOfWeek(new Date(), { weekStartsOn: 1 }),
    }),
  },
  {
    label: "Semaine dernière",
    range: () => ({
      from: startOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 }),
      to: endOfWeek(subDays(new Date(), 7), { weekStartsOn: 1 }),
    }),
  },
  { separator: true },
  { label: "Ce mois", range: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  {
    label: "Mois dernier",
    range: () => ({
      from: startOfMonth(subMonths(new Date(), 1)),
      to: endOfMonth(subMonths(new Date(), 1)),
    }),
  },
  { separator: true },
  { label: "Cette année", range: () => ({ from: startOfYear(new Date()), to: new Date() }) },
  {
    label: "Année dernière",
    range: () => ({
      from: startOfYear(subYears(new Date(), 1)),
      to: new Date(new Date().getFullYear() - 1, 11, 31),
    }),
  },
  { separator: true },
  { label: "Tout", range: () => null },
] as Array<{ label?: string; range?: () => DateRange | null; separator?: boolean }>;

function rangesEqual(a?: DateRange, b?: DateRange): boolean {
  if (!a?.from && !b?.from) return true;
  if (!a?.from || !b?.from) return false;
  const fromEq = format(a.from, "yyyy-MM-dd") === format(b.from, "yyyy-MM-dd");
  const aTo = a.to ?? a.from;
  const bTo = b.to ?? b.from;
  const toEq = format(aTo, "yyyy-MM-dd") === format(bTo, "yyyy-MM-dd");
  return fromEq && toEq;
}

// ─── Date range picker ──────────────────────────────────────
function DateRangePicker({
  dateRange,
  onDateRangeChange,
}: {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(undefined);

  const presets = useMemo(
    () =>
      DATE_PRESETS.map((p) => ({
        ...p,
        computed: p.range ? p.range() : undefined,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open]
  );

  const hasChanges = !rangesEqual(draft, dateRange);
  const hasDraft = !!draft?.from;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(dateRange);
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
            {dateRange.to &&
            format(dateRange.from, "yyyy-MM-dd") !== format(dateRange.to, "yyyy-MM-dd")
              ? `${format(dateRange.from, "dd MMM", { locale: fr })} – ${format(dateRange.to, "dd MMM", { locale: fr })}`
              : format(dateRange.from, "dd MMM yyyy", { locale: fr })}
            <span
              role="button"
              className="ml-0.5 rounded-full hover:bg-white/20 p-0.5 -mr-1"
              onClick={(e) => {
                e.stopPropagation();
                onDateRangeChange(undefined);
                setDraft(undefined);
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
            {presets.map((preset, i) => {
              if ("separator" in preset && preset.separator) {
                return <div key={`sep-${i}`} className="h-px bg-border my-1 mx-2" />;
              }
              const presetRange = preset.computed;
              const isActive =
                presetRange === null
                  ? !draft?.from
                  : presetRange
                    ? rangesEqual(draft, presetRange)
                    : false;
              return (
                <button
                  key={preset.label}
                  type="button"
                  className={cn(
                    "text-left text-[13px] px-3 py-1.5 rounded-lg transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-foreground/70 hover:bg-muted hover:text-foreground"
                  )}
                  onClick={() => {
                    if (presetRange === null) {
                      setDraft(undefined);
                      setOpen(false);
                      startTransition(() => onDateRangeChange(undefined));
                    } else if (presetRange) {
                      setDraft(presetRange);
                      setOpen(false);
                      startTransition(() => onDateRangeChange(presetRange));
                    }
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Calendars + footer */}
          <div className="p-3">
            <Calendar
              mode="range"
              selected={draft}
              onSelect={setDraft}
              numberOfMonths={2}
              locale={fr}
              fixedWeeks
              showYearSwitcher={false}
            />

            {/* Footer */}
            <div className="border-t mt-2 pt-3 flex items-center justify-between gap-4">
              <div className="font-heading tabular-nums text-[13px]">
                {draft?.from ? (
                  <>
                    <span className="text-foreground font-semibold">
                      {format(draft.from, "dd/MM/yyyy")}
                    </span>
                    <span className="mx-2 text-foreground/25">–</span>
                    <span
                      className={
                        draft.to ? "text-foreground font-semibold" : "text-muted-foreground"
                      }
                    >
                      {draft.to ? format(draft.to, "dd/MM/yyyy") : "jj/mm/aaaa"}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground font-normal text-[13px]">
                    Sélectionnez une période
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setDraft(dateRange);
                    setOpen(false);
                  }}
                >
                  Annuler
                </Button>
                <Button
                  size="sm"
                  className="text-xs"
                  disabled={!hasDraft || !hasChanges}
                  onClick={() => {
                    setOpen(false);
                    startTransition(() => onDateRangeChange(draft));
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
  );
}

// ─── Type filter chips ──────────────────────────────────────
const TYPE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "entry", label: "Entrées" },
  { value: "exit_technician", label: "Sortie technicien" },
  { value: "exit_anonymous", label: "Erreur stock" },
  { value: "assign_equipment", label: "Assignation outil" },
  { value: "unassign_equipment", label: "Retour outil" },
];

// ─── Main component ────────────────────────────────────────
export default function MovementsList() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [orgPickerOpen, setOrgPickerOpen] = useState(false);
  const [techPickerOpen, setTechPickerOpen] = useState(false);
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set());
  const [filterOrgs, setFilterOrgs] = useState<Set<string>>(new Set());
  const [filterTechs, setFilterTechs] = useState<Set<string>>(new Set());

  // Search: local state for instant input, debounced for filtering
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isInitialMount = useRef(true);

  const onSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(() => setDebouncedSearch(value));
    }, 300);
  }, []);

  // Fetch all movements (no org scoping — org is just a tag on entries)
  const { data: movementsResult, isLoading } = useStockMovements({});

  const allMovements = movementsResult?.movements || [];

  // Mark initial mount as done after first data load
  useEffect(() => {
    if (allMovements.length > 0 && isInitialMount.current) {
      // Defer so the first render gets the animation
      const id = requestAnimationFrame(() => {
        isInitialMount.current = false;
      });
      return () => cancelAnimationFrame(id);
    }
  }, [allMovements.length]);

  // Count per type for chip badges
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allMovements.length };
    for (const m of allMovements) {
      counts[m.movement_type] = (counts[m.movement_type] || 0) + 1;
    }
    return counts;
  }, [allMovements]);

  // Unique technicians from movements (for filter)
  const availableTechs = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const m of allMovements) {
      if (m.technician) {
        map.set(m.technician.id, {
          id: m.technician.id,
          name: `${m.technician.first_name} ${m.technician.last_name}`,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allMovements]);

  // User's organizations (for filter)
  const { data: userOrgs } = useOrganizations();

  const { availableOrgs, orgNameById } = useMemo(() => {
    const orgs = (userOrgs ?? []).map((o) => ({ id: o.id, name: o.name }));
    const map = new Map(orgs.map((o) => [o.id, o.name]));
    return { availableOrgs: orgs, orgNameById: map };
  }, [userOrgs]);

  // Helper to toggle a value in a Set (immutable)
  const toggleSet = useCallback((prev: Set<string>, value: string) => {
    const next = new Set(prev);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }, []);

  // Client-side type + search + date filter
  const filteredMovements = useMemo(() => {
    let result = allMovements;
    if (filterTypes.size > 0) {
      result = result.filter((m) => filterTypes.has(m.movement_type));
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
    if (filterOrgs.size > 0) {
      result = result.filter(
        (m) => m.movement_type === "entry" && m.organization_id && filterOrgs.has(m.organization_id)
      );
    }
    if (filterTechs.size > 0) {
      result = result.filter((m) => m.technician_id && filterTechs.has(m.technician_id));
    }
    if (dateRange?.from) {
      const fromTs = startOfDay(dateRange.from).getTime();
      const toTs = (dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from)).getTime();
      result = result.filter((m) => {
        if (!m.created_at) return false;
        const ts = new Date(m.created_at).getTime();
        return ts >= fromTs && ts <= toTs;
      });
    }
    return result;
  }, [allMovements, filterTypes, debouncedSearch, filterOrgs, filterTechs, dateRange]);

  const handleRowClick = (movement: StockMovement) => {
    if (movement.movement_type === "entry") {
      router.push(`/mouvements/entree/${movement.id}`);
    } else {
      router.push(`/mouvements/sortie/${movement.id}`);
    }
  };

  const columns: ColumnDef<StockMovement>[] = useMemo(
    () => [
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
        header: ({ column }) => <SortHeader label="Type" column={column} />,
        cell: ({ row }) => {
          const type = row.original.movement_type;
          const isEntry = type === "entry";
          const isEquipment = type === "assign_equipment" || type === "unassign_equipment";
          return (
            <div className="flex items-center gap-2">
              {isEquipment ? (
                <Wrench className="size-3.5 text-primary" />
              ) : isEntry ? (
                <ArrowDownToLine className="size-3.5 text-standard" />
              ) : type === "exit_anonymous" ? (
                <ArrowUpFromLine className="size-3.5 text-attention" />
              ) : (
                <ArrowUpFromLine className="size-3.5 text-critique" />
              )}
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[13px] font-medium",
                  type === "entry" && "text-standard bg-standard-bg",
                  type === "exit_technician" && "text-critique bg-critique-bg",
                  type === "exit_anonymous" && "text-attention bg-attention-bg",
                  isEquipment && "text-primary bg-primary/10"
                )}
              >
                {MOVEMENT_TYPE_LABELS[type]}
              </span>
            </div>
          );
        },
      },
      {
        id: "product",
        accessorFn: (row) => row.product?.name ?? "",
        header: ({ column }) => <SortHeader label="Produit" column={column} />,
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
        id: "organization",
        accessorFn: (row) => row.organization?.name ?? "",
        header: ({ column }) => <SortHeader label="Société" column={column} />,
        cell: ({ row }) => {
          if (row.original.movement_type !== "entry") {
            return <span className="text-muted-foreground">—</span>;
          }
          const org = row.original.organization;
          if (!org) return <span className="text-muted-foreground">—</span>;
          return <span className="text-[15px]">{org.name}</span>;
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
        id: "technician",
        accessorFn: (row) =>
          row.technician ? `${row.technician.first_name} ${row.technician.last_name}` : "",
        header: ({ column }) => <SortHeader label="Technicien" column={column} />,
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
    ],
    []
  );

  const table = useReactTable({
    data: filteredMovements,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
  });

  if (isLoading && allMovements.length === 0) {
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
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-white dark:bg-card"
          />
        </div>

        <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />

        {availableOrgs.length > 0 && (
          <Popover open={orgPickerOpen} onOpenChange={setOrgPickerOpen}>
            <PopoverTrigger
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all select-none cursor-pointer",
                filterOrgs.size > 0
                  ? "bg-primary text-primary-foreground"
                  : "bg-foreground/[0.06] text-foreground/70 hover:bg-foreground/[0.10]"
              )}
            >
              <Building2 className="size-3" />
              Entreprise
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
                {availableOrgs.map((sup) => {
                  const selected = filterOrgs.has(sup.id);
                  return (
                    <button
                      key={sup.id}
                      type="button"
                      className={cn(
                        "flex items-center gap-2 text-[13px] px-3 py-1.5 rounded-lg transition-colors",
                        selected
                          ? "bg-primary/10 text-foreground font-medium"
                          : "text-foreground/70 hover:bg-muted hover:text-foreground"
                      )}
                      onClick={() => {
                        startTransition(() => setFilterOrgs((prev) => toggleSet(prev, sup.id)));
                      }}
                    >
                      <span
                        className={cn(
                          "size-3.5 flex items-center justify-center",
                          !selected && "opacity-0"
                        )}
                      >
                        <Check className="size-3.5" />
                      </span>
                      {sup.name}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {availableTechs.length > 0 && (
          <Popover open={techPickerOpen} onOpenChange={setTechPickerOpen}>
            <PopoverTrigger
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all select-none cursor-pointer",
                filterTechs.size > 0
                  ? "bg-primary text-primary-foreground"
                  : "bg-foreground/[0.06] text-foreground/70 hover:bg-foreground/[0.10]"
              )}
            >
              <HardHat className="size-3" />
              Technicien
              {filterTechs.size > 0 && (
                <>
                  <span className="opacity-80 tabular-nums font-heading">{filterTechs.size}</span>
                  <span
                    role="button"
                    className="ml-0.5 rounded-full hover:bg-white/20 p-0.5 -mr-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      startTransition(() => setFilterTechs(new Set()));
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
                {availableTechs.map((tech) => {
                  const selected = filterTechs.has(tech.id);
                  return (
                    <button
                      key={tech.id}
                      type="button"
                      className={cn(
                        "flex items-center gap-2 text-[13px] px-3 py-1.5 rounded-lg transition-colors",
                        selected
                          ? "bg-primary/10 text-foreground font-medium"
                          : "text-foreground/70 hover:bg-muted hover:text-foreground"
                      )}
                      onClick={() => {
                        startTransition(() => setFilterTechs((prev) => toggleSet(prev, tech.id)));
                      }}
                    >
                      <span
                        className={cn(
                          "size-3.5 flex items-center justify-center",
                          !selected && "opacity-0"
                        )}
                      >
                        <Check className="size-3.5" />
                      </span>
                      {tech.name}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}

        <div className="flex items-center gap-1.5">
          {TYPE_FILTER_OPTIONS.map((opt) => {
            const isAll = opt.value === "all";
            const isActive = isAll ? filterTypes.size === 0 : filterTypes.has(opt.value);
            const count = typeCounts[opt.value] || 0;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  startTransition(() => {
                    if (isAll) {
                      setFilterTypes(new Set());
                    } else {
                      setFilterTypes((prev) => toggleSet(prev, opt.value));
                    }
                  })
                }
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
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row, index) => (
                <AnimatedRow
                  key={row.original.id}
                  index={index}
                  reducedMotion={prefersReducedMotion}
                  isInitial={isInitialMount.current}
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
                      {debouncedSearch ||
                      filterTypes.size > 0 ||
                      dateRange?.from ||
                      filterOrgs.size > 0 ||
                      filterTechs.size > 0
                        ? "Aucun mouvement ne correspond à ces filtres."
                        : "Les mouvements de stock apparaîtront ici."}
                    </p>
                  </div>
                </td>
              </tr>
            )}
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
