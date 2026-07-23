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
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  Building2,
  Truck,
  Activity,
  Tag,
  Plus,
  Archive,
  RotateCcw,
  ArrowDownUp,
  Check,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { SearchInput } from "@/components/search-input";
import { QueryError } from "@/components/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import StockEntryModal from "@/components/stock-entry-modal";
import StockExitModal from "@/components/stock-exit-modal";
import ReorderRecapModal, { computeReorderList } from "@/components/reorder-recap-modal";
import ExportStockPopover from "./export-stock-popover";
import { FilterChip } from "@/components/filter-chip";

import { ProductWithRelations } from "@/lib/supabase/queries/products";
import { calculateStockScore, getStockScoreColor, getStockBadgeVariant } from "@/lib/utils/stock";
import { StatusPill } from "@/components/ui/status-pill";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useProducts, useCategories, useOrganizations } from "@/hooks/queries";
import { useUnarchiveProduct } from "@/hooks/mutations";
import { toast } from "@/lib/toast";
import ProductIconDisplay from "@/components/product-icon-display";
import { TableColumnToggle } from "@/components/table-column-toggle";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { cn } from "@/lib/utils";

const fmtPrice = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

/** Les trois etats de stock, dans l'ordre ou l'on s'en preoccupe. */
const STATUS_OPTIONS = [
  { id: "critique", label: "Critique" },
  { id: "attention", label: "Attention" },
  { id: "standard", label: "Bon" },
];

// ─── En-tete de colonne, sans tri ──────────────────────────
//
// Le tri se faisait en cliquant les en-tetes, avec une fleche par colonne. Il
// vit maintenant dans un menu unique « Trier », comme sur Mouvements et Achats
// dont les fleches ont ete retirees : une seule facon de trier, annoncee, plutot
// qu'une possibilite cachee derriere chaque titre.
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

// ─── Options de tri ─────────────────────────────────────────
//
// Defaut : Nom A→Z. Une liste ou l'on cherche un produit doit etre previsible —
// on sait toujours ou regarder. Trier par stock la fait bouger a chaque
// mouvement, deroutant quand on cherche une reference precise ; c'est utile,
// mais c'est un choix, pas le defaut. « Stock croissant » vient juste apres :
// c'est la reponse a « qu'est-ce que je dois recommander ? ».
const SORT_OPTIONS: { id: string; label: string; sorting: SortingState }[] = [
  { id: "name-asc", label: "Nom (A → Z)", sorting: [{ id: "name", desc: false }] },
  { id: "name-desc", label: "Nom (Z → A)", sorting: [{ id: "name", desc: true }] },
  { id: "stock-asc", label: "Stock (croissant)", sorting: [{ id: "stock_current", desc: false }] },
  {
    id: "stock-desc",
    label: "Stock (décroissant)",
    sorting: [{ id: "stock_current", desc: true }],
  },
  { id: "price-desc", label: "Prix (élevé → bas)", sorting: [{ id: "price", desc: true }] },
  { id: "price-asc", label: "Prix (bas → élevé)", sorting: [{ id: "price", desc: false }] },
];

// ─── Main component ────────────────────────────────────────
export default function ProductList() {
  const router = useRouter();
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();
  // Defaut : Nom A→Z. Voir SORT_OPTIONS pour le raisonnement.
  const [sorting, setSorting] = useState<SortingState>(SORT_OPTIONS[0].sorting);
  const [filters, setFilters] = useQueryStates({
    search: parseAsString.withDefault(""),
  });

  // Stock movement modal state
  const [entryProductId, setEntryProductId] = useState<string | null>(null);
  const [exitProductId, setExitProductId] = useState<string | null>(null);
  const [reorderOpen, setReorderOpen] = useState(false);

  // Multi-select filters
  const [filterCategories, setFilterCategories] = useState<Set<string>>(new Set());
  const [filterSuppliers, setFilterSuppliers] = useState<Set<string>>(new Set());
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set());
  const [filterOrgs, setFilterOrgs] = useState<Set<string>>(new Set());

  // Vue « archives » : un produit retiré du catalogue disparaissait sans
  // recours. Comme pour l'outillage, elle sert à le retrouver et le restaurer.
  const [showArchived, setShowArchived] = useState(false);
  const unarchive = useUnarchiveProduct();

  const handleRestore = (id: string, name: string) => {
    unarchive.mutate(id, {
      onSuccess: () => toast.success(`${name} remis au catalogue`),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur"),
    });
  };

  const searchQuery = filters.search;
  const setSearchQuery = (value: string) => setFilters({ search: value });

  const toggleSet = (prev: Set<string>, value: string) => {
    const next = new Set(prev);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // Option de tri active, deduite de l'etat plutot que tenue en double : le
  // menu et le tableau ne peuvent pas diverger. Un tri par colonne inconnu du
  // menu (aucun aujourd'hui) laisse simplement le libelle par defaut.
  const current = sorting[0];
  const activeSortId =
    SORT_OPTIONS.find((o) => o.sorting[0].id === current?.id && o.sorting[0].desc === current?.desc)
      ?.id ?? SORT_OPTIONS[0].id;

  const { data: categories = [] } = useCategories(currentOrganization?.id);
  const { data: userOrgs } = useOrganizations();
  const isMultiOrg = (userOrgs?.length ?? 0) > 1;

  const {
    data: productsResult,
    isLoading,
    isError,
    refetch,
  } = useProducts({
    // La societe reste transmise : elle conditionne le declenchement de la
    // requete. L'omettre desactivait le hook, la liste restait vide et bloquee
    // en chargement.
    organizationId: currentOrganization?.id,
    // Vue consolidee : le chiffre est le total des societes, comme sur la
    // fiche produit ou l'on atterrit en cliquant une ligne. La ventilation
    // sous le chiffre dit qui detient quoi. Les ecrans qui font agir gardent
    // le stock de la societe : leur nombre borne ce qu'on peut saisir.
    stockScope: "all",
    search: debouncedSearch || undefined,
    archived: showArchived,
  });

  // Memoise : sans cela le `|| []` cree un tableau neuf a chaque rendu, et
  // tous les useMemo qui en dependent se recalculent pour rien.
  const allProducts = useMemo(() => productsResult?.products ?? [], [productsResult]);

  // Options des filtres, tirees du catalogue charge : on ne propose que des
  // valeurs qui existent, plutot qu'une liste ou la moitie ne donne rien.
  const categoryOptions = useMemo(
    () => categories.map((c) => ({ id: c.id, label: c.name })),
    [categories]
  );

  const supplierOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of allProducts) {
      if (p.supplier?.id) seen.set(p.supplier.id, p.supplier.name);
    }
    return [...seen.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [allProducts]);

  // Client-side multi-select filtering
  const products = useMemo(() => {
    let result = allProducts;
    if (filterCategories.size > 0) {
      result = result.filter((p) => p.category_id && filterCategories.has(p.category_id));
    }
    if (filterSuppliers.size > 0) {
      result = result.filter((p) => p.supplier_id && filterSuppliers.has(p.supplier_id));
    }
    if (filterOrgs.size > 0) {
      // « Detenu par » : on garde les produits dont au moins une des societes
      // cochees possede du stock.
      result = result.filter((p) =>
        p.product_organization_stock?.some(
          (pos) => filterOrgs.has(pos.organization_id) && pos.stock_current > 0
        )
      );
    }
    if (filterStatuses.size > 0) {
      // Le statut se recalcule a la volee : il derive du stock et du seuil,
      // il n'existe pas comme colonne. Le filtrer en base demanderait de
      // reproduire le calcul en SQL, avec le risque qu'il diverge.
      result = result.filter((p) =>
        filterStatuses.has(getStockBadgeVariant(calculateStockScore(p.stock_current, p.stock_min)))
      );
    }
    return result;
  }, [allProducts, filterCategories, filterSuppliers, filterStatuses, filterOrgs]);

  // Un seul point de verite : ajouter un filtre sans mettre a jour l'etat vide
  // afficherait « ajoutez vos produits » alors qu'un filtre masque tout.
  const hasActiveFilter =
    Boolean(searchQuery) ||
    filterCategories.size > 0 ||
    filterSuppliers.size > 0 ||
    filterStatuses.size > 0 ||
    filterOrgs.size > 0;

  const [columnVisibility, setColumnVisibility] = useColumnVisibility("produits");

  // Reorder computation — products at or below stock_min
  const reorderItems = useMemo(() => computeReorderList(allProducts), [allProducts]);
  const reorderCount = reorderItems.length;

  // Micro-bars are now per-product relative to their own threshold (not global max)

  const columns: ColumnDef<ProductWithRelations>[] = [
    {
      accessorKey: "name",
      enableHiding: false,
      header: () => <ColHeader label="Produit" />,
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
      header: () => <ColHeader label="Stock" />,
      cell: ({ row }) => {
        const product = row.original;

        // `stock_current` porte deja le stock de la societe consultee : la
        // requete le substitue a la source. Cette colonne refaisait le calcul
        // a partir du filtre manuel « Societe », qui n'etait pas branche sur
        // le selecteur de societe — et la colonne Statut, elle, ne le refaisait
        // pas : les deux se contredisaient a l'ecran.
        const displayStock = product.stock_current ?? 0;

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
            {/* Ventilation toujours visible : le gros chiffre est le total des
                societes, cette ligne le detaille. Sans elle on ne saurait pas
                qu'une societe est a sec derriere un total confortable. Elle
                etait masquee des qu'un filtre societe etait actif, c'est-a-dire
                justement quand la comparaison sert. */}
            {isMultiOrg && product.product_type !== "equipment" && (
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
      header: () => <ColHeader label="Prix HT" />,
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
      header: () => <ColHeader label="Catégorie" />,
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
      header: () => <ColHeader label="Fournisseur" />,
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
          {showArchived ? "Motif" : "Statut"}
        </span>
      ),
      cell: ({ row }) => {
        const product = row.original;
        // En archives, l'état de stock ne dit plus rien — la fiche n'est plus
        // au catalogue. Ce qu'on vient lire, c'est pourquoi elle en est sortie.
        if (showArchived) {
          const p = product as ProductWithRelations & { archive_reason?: string | null };
          return p.archive_reason ? (
            <span className="line-clamp-2 max-w-[280px] text-sm">{p.archive_reason}</span>
          ) : (
            <span className="text-sm italic text-muted-foreground/70">Aucun motif</span>
          );
        }
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
        // Entrer ou sortir du stock n'a pas de sens sur une fiche hors
        // catalogue : le seul geste utile est de la remettre en service.
        if (showArchived) {
          return (
            <div className="flex items-center justify-end">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs"
                disabled={unarchive.isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRestore(product.id, product.name);
                }}
              >
                <RotateCcw className="size-3.5" />
                Restaurer
              </Button>
            </div>
          );
        }
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
        <div className="rounded-xl border bg-card overflow-x-auto">
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
          {/* Trois filtres, un seul composant. Les popovers etaient recopies
              a l'identique : le filtre « Societe » a ete retire (le catalogue
              est commun, filtrer dessus n'apprenait rien), et fournisseur et
              statut manquaient alors qu'ils portent les questions courantes —
              qui fournit quoi, et qu'est-ce qui est critique. */}
          <FilterChip
            label="Catégorie"
            icon={Tag}
            options={categoryOptions}
            selected={filterCategories}
            onToggle={(id) => setFilterCategories((prev) => toggleSet(prev, id))}
            onClear={() => setFilterCategories(new Set())}
          />
          <FilterChip
            label="Fournisseur"
            icon={Truck}
            options={supplierOptions}
            selected={filterSuppliers}
            onToggle={(id) => setFilterSuppliers((prev) => toggleSet(prev, id))}
            onClear={() => setFilterSuppliers(new Set())}
          />
          <FilterChip
            label="Statut"
            icon={Activity}
            options={STATUS_OPTIONS}
            selected={filterStatuses}
            onToggle={(id) => setFilterStatuses((prev) => toggleSet(prev, id))}
            onClear={() => setFilterStatuses(new Set())}
          />
          {/* Societe : la liste montre toujours les deux, ce filtre sert a
              repondre a « qu'est-ce que SEIREN detient reellement ? ». Il ne
              cache rien par defaut — c'est un outil de reduction, pas un
              cloisonnement. */}
          {isMultiOrg && (
            <FilterChip
              label="Société"
              icon={Building2}
              options={(userOrgs ?? []).map((o) => ({ id: o.id, label: o.name }))}
              selected={filterOrgs}
              onToggle={(id) => setFilterOrgs((prev) => toggleSet(prev, id))}
              onClear={() => setFilterOrgs(new Set())}
            />
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/* Tri : un menu unique, plutôt que des flèches semées sur chaque
              en-tête. Le libellé porte le tri actif — on lit d'un coup dans
              quel ordre la liste est rangée. */}
          <Popover>
            <PopoverTrigger className="inline-flex h-9 shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-full bg-foreground/[0.06] px-4 text-[13px] font-semibold text-foreground/70 outline-none transition-all hover:bg-foreground/[0.10] focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.97]">
              <ArrowDownUp className="size-3.5" />
              {SORT_OPTIONS.find((o) => o.id === activeSortId)?.label ?? "Trier"}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-1 rounded-xl">
              {SORT_OPTIONS.map((opt) => {
                const active = opt.id === activeSortId;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSorting(opt.sorting)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[13px] transition-colors",
                      active
                        ? "bg-primary/10 font-medium text-foreground"
                        : "text-foreground/70 hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {opt.label}
                    {active && <Check className="size-3.5 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>

          {/* Bascule vers les fiches retirées du catalogue. Poussée à droite,
              à l'écart des filtres du quotidien : ce n'est pas une facette de
              plus, c'est une autre vue. */}
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className={cn(
              "inline-flex h-9 shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.97]",
              showArchived
                ? "bg-primary text-primary-foreground"
                : "bg-foreground/[0.06] text-foreground/70 hover:bg-foreground/[0.10]"
            )}
          >
            <Archive className="size-3.5" />
            Archivés
          </button>
          <TableColumnToggle table={table} />
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
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
                      {showArchived ? (
                        <Archive className="size-7 text-muted-foreground" />
                      ) : (
                        <Package className="size-7 text-muted-foreground" />
                      )}
                    </div>
                    {/* Un état vide parle de l'endroit où l'on se trouve : dans
                        les archives, proposer « Ajoutez un produit » n'aurait
                        aucun rapport avec ce qu'on y cherche. */}
                    <h3 className="text-lg font-semibold">
                      {showArchived ? "Aucun produit archivé" : "Aucun produit"}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                      {showArchived
                        ? hasActiveFilter
                          ? "Aucun produit archivé ne correspond à cette recherche."
                          : "Les produits retirés du catalogue apparaîtront ici, avec leur motif. Ils restent restaurables."
                        : hasActiveFilter
                          ? "Aucun produit ne correspond à cette recherche."
                          : "Ajoutez vos produits pour commencer à gérer votre stock."}
                    </p>
                    {showArchived ? (
                      <Button
                        variant="outline"
                        className="mt-5"
                        onClick={() => setShowArchived(false)}
                      >
                        Revenir au catalogue
                      </Button>
                    ) : (
                      !hasActiveFilter && (
                        <Button asChild className="mt-5">
                          <Link href="/produits/nouveau">Ajouter un produit</Link>
                        </Button>
                      )
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
