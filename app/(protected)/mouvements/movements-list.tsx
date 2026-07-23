"use client";

import { startTransition, useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import {
  Archive,
  History,
  CalendarDays,
  Building2,
  ChevronLeft,
  ChevronRight,
  Download,
  Truck,
  Undo2,
  HardHat,
  X,
} from "lucide-react";

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
import { SearchInput } from "@/components/search-input";
import { QueryError } from "@/components/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import { HeroNumber } from "@/components/ui/hero-number";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  StockMovement,
  MOVEMENT_TYPE_LABELS,
  getStockMovements,
  isPositiveMovement,
  type MovementType,
} from "@/lib/supabase/queries/stock-movements";
import { toast } from "@/lib/toast";
import { exportMovementsExcel } from "@/lib/utils/excel-export";
import {
  useStockMovements,
  useMovementTypeCounts,
  useOrganizations,
  useTechnicians,
  useSuppliers,
} from "@/hooks/queries";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import ProductIconDisplay from "@/components/product-icon-display";
import { FilterChip } from "@/components/filter-chip";
import { MovementTypePill } from "@/components/movement-type-pill";
import { TableColumnToggle } from "@/components/table-column-toggle";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { cn } from "@/lib/utils";

const fmtPrice = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/**
 * Intitule de colonne, sans tri.
 *
 * Le tableau etait triable colonne par colonne. Un journal se lit dans
 * l'ordre chronologique : le trier par quantite ou par montant en fait une
 * liste de valeurs qui ne raconte plus rien, et seules quatre colonnes sur
 * huit etaient triables — les autres portaient un intitule inerte d'aspect
 * identique. L'ordre est desormais fixe, du plus recent au plus ancien, et
 * le filtrage repond aux questions que le tri servait a poser.
 */
function ColHeader({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-xs font-semibold uppercase tracking-wider text-foreground/50 select-none",
        className
      )}
    >
      {label}
    </span>
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
          "inline-flex items-center gap-1.5 rounded-full h-9 px-4 text-[13px] font-semibold transition-all select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.97]",
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
  { value: "exit_anonymous", label: "Perte ou erreur" },
  { value: "assign_equipment", label: "Assignation outil" },
  { value: "unassign_equipment", label: "Retour outil" },
];

// ─── Main component ────────────────────────────────────────
export default function MovementsList() {
  const router = useRouter();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: startOfYear(new Date()),
    to: new Date(),
  }));
  // FilterChip gere lui-meme son ouverture : les trois etats de popover
  // qui vivaient ici n'ont plus d'objet.
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set());
  const [filterOrgs, setFilterOrgs] = useState<Set<string>>(new Set());
  const [filterSuppliers, setFilterSuppliers] = useState<Set<string>>(new Set());
  const [filterTechs, setFilterTechs] = useState<Set<string>>(new Set());
  const [columnVisibility, setColumnVisibility] = useColumnVisibility("mouvements");

  // Search: local state for instant input, debounced for filtering
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const currentOrgId = useOrganizationStore((s) => s.currentOrganization?.id);
  const [isExporting, setIsExporting] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  // Tous les filtres partent au serveur. Auparavant la page rapatriait
  // l'historique complet puis filtrait en memoire : au-dela de 1000 lignes,
  // Supabase tronquait en silence et le total affiche devenait la limite.
  const serverFilters = useMemo(
    () => ({
      movementTypes: filterTypes.size > 0 ? (Array.from(filterTypes) as MovementType[]) : undefined,
      organizationIds: filterOrgs.size > 0 ? Array.from(filterOrgs) : undefined,
      supplierIds: filterSuppliers.size > 0 ? Array.from(filterSuppliers) : undefined,
      technicianIds: filterTechs.size > 0 ? Array.from(filterTechs) : undefined,
      search: debouncedSearch || undefined,
      // Ordre fixe : un journal se lit du plus recent au plus ancien.
      sortBy: "created_at" as const,
      sortDir: "desc" as const,
      startDate: dateRange?.from ? startOfDay(dateRange.from).toISOString() : undefined,
      endDate: dateRange?.to
        ? endOfDay(dateRange.to).toISOString()
        : dateRange?.from
          ? endOfDay(dateRange.from).toISOString()
          : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [filterTypes, filterOrgs, filterSuppliers, filterTechs, debouncedSearch, dateRange, page]
  );

  const { data: movementsResult, isLoading, isError, refetch } = useStockMovements(serverFilters);

  const movements = useMemo(() => movementsResult?.movements ?? [], [movementsResult]);
  const totalCount = movementsResult?.total ?? 0;
  const totalPages = movementsResult?.totalPages ?? 0;

  // Un changement de filtre doit ramener a la premiere page, sinon on reste
  // sur une page 7 qui n'existe plus dans le nouveau resultat.
  const filterSignature = `${Array.from(filterTypes).sort().join()}|${Array.from(filterOrgs).sort().join()}|${Array.from(filterSuppliers).sort().join()}|${Array.from(filterTechs).sort().join()}|${debouncedSearch}|${dateRange?.from?.toISOString() ?? ""}|${dateRange?.to?.toISOString() ?? ""}`;
  const [prevSignature, setPrevSignature] = useState(filterSignature);
  if (filterSignature !== prevSignature) {
    setPrevSignature(filterSignature);
    setPage(1);
  }

  // Compteurs des pastilles : issus d'un comptage serveur, pas des lignes
  // chargees — une page de 50 donnerait des totaux faux.
  const { data: typeCounts = {} } = useMovementTypeCounts();

  // Listes de filtres : lues dans leurs propres tables. Les deduire des
  // mouvements charges limiterait les choix a ce que contient la page courante.
  const { data: allTechnicians = [] } = useTechnicians(currentOrgId);
  const availableTechs = useMemo(
    () =>
      allTechnicians
        .map((t) => ({ id: t.id, name: `${t.first_name} ${t.last_name}` }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [allTechnicians]
  );

  const { data: allSuppliers = [] } = useSuppliers(currentOrgId);
  const availableSuppliers = useMemo(
    () =>
      allSuppliers
        .map((s) => ({ id: s.id, name: s.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [allSuppliers]
  );

  // User's organizations (for filter)
  const { data: userOrgs } = useOrganizations();

  const { availableOrgs } = useMemo(() => {
    const orgs = (userOrgs ?? []).map((o) => ({ id: o.id, name: o.name }));
    return { availableOrgs: orgs };
  }, [userOrgs]);

  // Helper to toggle a value in a Set (immutable)
  const toggleSet = useCallback((prev: Set<string>, value: string) => {
    const next = new Set(prev);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }, []);

  // Valeur de la page affichee. Seules les entrees portent un prix unitaire.
  // Les corrections sont exclues : une annulation porte le meme prix unitaire
  // que le mouvement qu'elle defait, l'additionner doublerait le montant.
  const pageValue = useMemo(
    () =>
      movements.reduce(
        (sum, m) =>
          m.unit_price && !m.reverses_movement_id ? sum + m.quantity * Number(m.unit_price) : sum,
        0
      ),
    [movements]
  );

  /**
   * Export Excel de la selection filtree, toutes pages confondues.
   *
   * On rappelle la requete sans pagination plutot que d'exporter les 50 lignes
   * affichees : un export partiel qui ne le dit pas est pire que pas d'export.
   */
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { movements: all } = await getStockMovements({
        ...serverFilters,
        page: 1,
        pageSize: 5000,
      });

      // Les filtres sont rappeles en clair dans le fichier : un export sorti
      // de son contexte ne dit plus sur quoi il porte.
      const activeFilters: string[] = [];
      if (debouncedSearch) activeFilters.push(`recherche « ${debouncedSearch} »`);
      if (filterTypes.size > 0)
        activeFilters.push(
          Array.from(filterTypes)
            .map((t) => MOVEMENT_TYPE_LABELS[t as MovementType] ?? t)
            .join(", ")
        );
      if (filterOrgs.size > 0) activeFilters.push(`${filterOrgs.size} société(s)`);
      if (filterSuppliers.size > 0) activeFilters.push(`${filterSuppliers.size} fournisseur(s)`);
      if (filterTechs.size > 0) activeFilters.push(`${filterTechs.size} technicien(s)`);

      const periodLabel = dateRange?.from
        ? dateRange.to &&
          format(dateRange.from, "yyyy-MM-dd") !== format(dateRange.to, "yyyy-MM-dd")
          ? `du ${format(dateRange.from, "d MMMM yyyy", { locale: fr })} au ${format(dateRange.to, "d MMMM yyyy", { locale: fr })}`
          : format(dateRange.from, "d MMMM yyyy", { locale: fr })
        : "tout l'historique";

      await exportMovementsExcel({
        movements: all,
        periodLabel,
        filtersLabel: activeFilters.length > 0 ? activeFilters.join(" · ") : "aucun",
        totalMatching: totalCount,
      });

      if (all.length < totalCount) {
        toast.error(`Export limité à ${all.length} lignes sur ${totalCount}. Affinez les filtres.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'export");
    } finally {
      setIsExporting(false);
    }
  };

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
        meta: { label: "Date" },
        header: () => <ColHeader label="Date" />,
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
        meta: { label: "Type" },
        header: () => <ColHeader label="Type" />,
        // Le motif ne s'affiche plus dans la liste : le journal se parcourt du
        // regard, la phrase « cassée sur le chantier de Nantes » sous chaque
        // ligne l'alourdissait sans qu'on la lise vraiment. Il se lit quand on
        // vient chercher le pourquoi — sur le detail du mouvement, en cliquant.
        cell: ({ row }) => <MovementTypePill type={row.original.movement_type} />,
      },
      {
        // Un mouvement de correction ressemble a un mouvement ordinaire :
        // sans marqueur, il gonflerait la lecture des entrees et sorties.
        id: "correction",
        meta: { label: "Correction" },
        accessorFn: (row) => (row.reverses_movement_id ? 1 : 0),
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
            Correction
          </span>
        ),
        cell: ({ row }) =>
          row.original.reverses_movement_id ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] font-semibold"
              title="Ce mouvement annule un mouvement precedent"
            >
              <Undo2 className="size-3" />
              Annulation
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "product",
        enableHiding: false,
        accessorFn: (row) => row.product?.name ?? "",
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
            Produit
          </span>
        ),
        cell: ({ row }) => {
          const product = row.original.product;
          return (
            <div className="flex items-center gap-4">
              <ProductIconDisplay imageUrl={product?.image_url} size="md" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[15px] leading-tight">
                    {product?.name || "Produit inconnu"}
                  </span>
                  {/* Le mouvement reste vrai, mais le produit a quitte le
                      catalogue : sans ce reperage on lit un nom sans savoir
                      que sa fiche n'existe plus. Le motif est en infobulle. */}
                  {product?.archived_at && (
                    <span
                      title={
                        product.archive_reason
                          ? `Archivé — ${product.archive_reason}`
                          : "Archivé, sans motif enregistré"
                      }
                      className="shrink-0 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      <Archive className="size-2.5" />
                      Archivé
                    </span>
                  )}
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
      // Technicien right after Produit — most actionable info close (Hodent)
      {
        id: "technician",
        meta: { label: "Technicien" },
        accessorFn: (row) =>
          row.technician ? `${row.technician.first_name} ${row.technician.last_name}` : "",
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
            Technicien
          </span>
        ),
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
        accessorKey: "quantity",
        header: () => <ColHeader label="Qté" />,
        cell: ({ row }) => {
          const type = row.original.movement_type;
          const isPositive = isPositiveMovement(type);
          return (
            <span
              className={cn(
                "font-heading font-bold tabular-nums text-xl",
                isPositive ? "text-standard" : "text-critique"
              )}
            >
              {isPositive ? "+" : "−"}
              {row.original.quantity}
            </span>
          );
        },
        meta: { label: "Qté", align: "right" },
      },
      {
        // 96 mouvements portent un prix unitaire, pour pres de 92 000 EUR
        // d'entrees : aucune colonne ne les montrait.
        id: "total_value",
        accessorFn: (row) => (row.unit_price ? row.quantity * Number(row.unit_price) : 0),
        header: () => <ColHeader label="Montant" />,
        cell: ({ row }) => {
          const price = row.original.unit_price;
          if (!price) return <span className="text-muted-foreground">—</span>;
          const value = row.original.quantity * Number(price);
          return (
            <div className="leading-tight">
              <span className="font-heading font-semibold tabular-nums text-sm">
                {fmtPrice(value)}
              </span>
              <span className="block text-[11px] text-muted-foreground tabular-nums">
                {fmtPrice(Number(price))} /u
              </span>
            </div>
          );
        },
        meta: { label: "Montant", align: "right" },
      },
      {
        id: "organization",
        meta: { label: "Société" },
        accessorFn: (row) => row.organization?.name ?? "",
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
            Société
          </span>
        ),
        cell: ({ row }) => {
          const org = row.original.organization;
          if (!org) return <span className="text-muted-foreground">—</span>;
          return <span className="text-[15px]">{org.name}</span>;
        },
      },
      {
        // Qui a saisi le mouvement — un membre de l'organisation, pas le
        // technicien destinataire. Une ligne fausse doit se remonter a quelqu'un,
        // et une correction avoir un responsable. Les mouvements anterieurs au
        // suivi n'ont pas d'auteur : c'est la verite, personne n'etait enregistre.
        id: "author",
        meta: { label: "Auteur" },
        accessorFn: (row) => row.author?.display_name ?? row.author?.email ?? "",
        header: () => <ColHeader label="Auteur" />,
        cell: ({ row }) => {
          const author = row.original.author;
          const label = author?.display_name || author?.email;
          if (!label) return <span className="text-muted-foreground">—</span>;
          return <span className="text-[15px]">{label}</span>;
        },
      },
      {
        id: "supplier",
        meta: { label: "Fournisseur" },
        accessorFn: (row) => row.supplier?.name ?? "",
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
            Fournisseur
          </span>
        ),
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
        // Le numero saisi a l'entree, tel quel. Il n'y a plus de facture a
        // ouvrir : la colonne n'est plus un lien, juste une reference qu'on
        // retrouve pour rapprocher un achat de son document papier.
        id: "invoice",
        meta: { label: "N° facture" },
        accessorFn: (row) => row.invoice_reference ?? "",
        header: () => (
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
            N° facture
          </span>
        ),
        cell: ({ row }) => {
          const reference = row.original.invoice_reference;
          if (!reference) return <span className="text-muted-foreground">—</span>;
          return <span className="text-[15px]">{reference}</span>;
        },
      },
    ],
    []
  );

  // Ni tri client ni tri serveur pilote par l'entete : l'ordre du journal est
  // fixe. getSortedRowModel reordonnerait de toute facon les seules 50 lignes
  // de la page courante, en laissant croire a un classement sur l'ensemble.
  const table = useReactTable({
    data: movements,
    columns,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    state: { columnVisibility },
  });

  if (isLoading && movements.length === 0) {
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
                <th className="h-11 px-5 text-left">
                  <Skeleton className="h-3 w-8" />
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
                  <td className="px-5 py-4">
                    <Skeleton className="h-5 w-8" />
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

  if (isError) {
    return <QueryError message="Impossible de charger les mouvements." onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-3">
      {/* Titre et export. L'export vit ici et non dans un composant d'en-tete
          separe : il doit connaitre les filtres courants pour exporter la
          selection, pas l'historique entier. */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Mouvements de stock</h1>
        <Button
          variant="outline"
          className="bg-white dark:bg-card"
          onClick={handleExport}
          disabled={isExporting || totalCount === 0}
        >
          <Download className="mr-2 size-4" />
          {isExporting ? "Export…" : "Exporter"}
        </Button>
      </div>

      {/* Recherche compacte, filtres au premier plan — meme dosage que la
          liste produits : la recherche prenait toute la largeur et repoussait
          les filtres, alors que ce sont eux qu'on utilise le plus ici. */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Rechercher…"
          className="bg-white dark:bg-card h-9"
          wrapperClassName="w-full sm:w-52 shrink-0"
        />

        <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />

        <FilterChip
          label="Entreprise"
          icon={Building2}
          options={availableOrgs.map((o) => ({ id: o.id, label: o.name }))}
          selected={filterOrgs}
          onToggle={(id) => startTransition(() => setFilterOrgs((prev) => toggleSet(prev, id)))}
          onClear={() => startTransition(() => setFilterOrgs(new Set()))}
        />

        <FilterChip
          label="Fournisseur"
          icon={Truck}
          options={availableSuppliers.map((s) => ({ id: s.id, label: s.name }))}
          selected={filterSuppliers}
          onToggle={(id) =>
            startTransition(() => setFilterSuppliers((prev) => toggleSet(prev, id)))
          }
          onClear={() => startTransition(() => setFilterSuppliers(new Set()))}
        />

        <FilterChip
          label="Technicien"
          icon={HardHat}
          options={availableTechs.map((t) => ({ id: t.id, label: t.name }))}
          selected={filterTechs}
          onToggle={(id) => startTransition(() => setFilterTechs((prev) => toggleSet(prev, id)))}
          onClear={() => startTransition(() => setFilterTechs(new Set()))}
        />

        <FilterChip
          label="Type"
          icon={History}
          hideWhenEmpty={false}
          options={TYPE_FILTER_OPTIONS.filter((o) => o.value !== "all").map((o) => ({
            id: o.value,
            label: o.label,
            count: typeCounts[o.value] || 0,
          }))}
          selected={filterTypes}
          onToggle={(id) => startTransition(() => setFilterTypes((prev) => toggleSet(prev, id)))}
          onClear={() => startTransition(() => setFilterTypes(new Set()))}
        />

        {/* Repousse a droite : les filtres se choisissent, les colonnes se
            reglent une fois — ce n'est pas au meme niveau d'usage. */}
        <TableColumnToggle table={table} className="ml-auto" />
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-x-auto">
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
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.original.id}
                  className="group border-b last:border-b-0 cursor-pointer transition-colors hover:bg-muted/50"
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
                </tr>
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
                      filterSuppliers.size > 0 ||
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

      {/* Pied : total reel + valeur + pagination.
          Le total vient d'un count serveur — il ne peut plus se confondre
          avec le nombre de lignes recues. */}
      {totalCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="text-muted-foreground text-sm">
            <HeroNumber value={totalCount} className="text-sm" /> mouvement
            {totalCount > 1 ? "s" : ""}
            {pageValue > 0 && (
              <>
                {" · "}
                <span className="font-heading font-semibold text-foreground tabular-nums">
                  {fmtPrice(pageValue)}
                </span>{" "}
                sur cette page
              </>
            )}
          </p>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4" />
                Précédent
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Suivant
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
