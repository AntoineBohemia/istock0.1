"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  ChevronLeft,
  ChevronRight,
  Package,
  Phone,
  Plus,
  UserPlus,
} from "lucide-react";
import { SearchInput } from "@/components/search-input";
import { QueryError } from "@/components/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { HeroNumber } from "@/components/ui/hero-number";
import { Button } from "@/components/ui/button";

import { TechnicianWithInventory } from "@/lib/supabase/queries/technicians";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import Link from "next/link";
import { useTechnicians, useVehicles } from "@/hooks/queries";
import { TableColumnToggle } from "@/components/table-column-toggle";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { cn } from "@/lib/utils";
import RestockDialog from "./[id]/restock-dialog";
import CreateTechnicianDialog from "./create-technician-dialog";

// ─── Sort header button ────────────────────────────────────
function SortHeader({
  label,
  column,
  className,
}: {
  label: string;
  column: {
    toggleSorting: (asc: boolean) => void;
    getIsSorted: () => false | "asc" | "desc";
  };
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

// ─── Restock urgency helpers ───────────────────────────────
function daysSince(dateString: string | null): number | null {
  if (!dateString) return null;
  const diff = Date.now() - new Date(dateString).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function restockLabel(days: number | null): string {
  if (days === null) return "Jamais";
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  return `il y a ${days}j`;
}

/** Date et heure exactes du dernier réappro */
function restockDateTime(dateString: string | null): string | null {
  if (!dateString) return null;
  return new Date(dateString).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Filter helpers ──────────────────────────────────────────

// ─── Main component ────────────────────────────────────────
export default function TechniciansList() {
  const router = useRouter();
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const {
    data: technicians = [],
    isLoading,
    isError,
    refetch,
  } = useTechnicians(currentOrganization?.id, selectedYear);

  const [sorting, setSorting] = useState<SortingState>([{ id: "restock", desc: true }]);
  const [{ search: searchQuery }, setFilters] = useQueryStates({
    search: parseAsString.withDefault(""),
  });
  const setSearchQuery = (value: string) => setFilters({ search: value || null });
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const [restockTechId, setRestockTechId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Véhicule assigné : source de vérité = la table vehicles, pas les anciennes
  // colonnes vehicle_* des techniciens.
  const { data: vehicles = [] } = useVehicles(currentOrganization?.id);
  const vehicleByTechnician = useMemo(() => {
    const map = new Map<string, (typeof vehicles)[number]>();
    for (const v of vehicles) {
      if (v.technician_id) map.set(v.technician_id, v);
    }
    return map;
  }, [vehicles]);

  // Recherche elargie : les colonnes affichees doivent toutes etre cherchables,
  // sinon on cherche « Kangoo » ou un numero et la liste repond vide.
  const filteredData = useMemo(() => {
    if (!debouncedSearch) return technicians;
    const q = debouncedSearch.toLowerCase();
    return technicians.filter((tech) => {
      const vehicle = vehicleByTechnician.get(tech.id);
      return [
        `${tech.first_name} ${tech.last_name}`,
        tech.phone ?? "",
        tech.email ?? "",
        tech.city ?? "",
        tech.organization_name ?? "",
        vehicle?.name ?? "",
        vehicle?.license_plate ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [technicians, debouncedSearch, vehicleByTechnician]);

  const [columnVisibility, setColumnVisibility] = useColumnVisibility("techniciens", {
    organization: false,
    email: false,
  });

  const yearLabel = `Unités (${selectedYear})`;
  const columns: ColumnDef<TechnicianWithInventory>[] = [
    {
      accessorKey: "name",
      enableHiding: false,
      accessorFn: (row) => `${row.first_name} ${row.last_name}`,
      header: ({ column }) => <SortHeader label="Technicien" column={column} />,
      cell: ({ row }) => {
        const tech = row.original;
        return (
          <div className="flex items-center gap-4">
            <Avatar className="size-9">
              {tech.photo_url && <AvatarImage src={tech.photo_url} />}
              <AvatarFallback className="text-xs font-semibold">
                {tech.first_name.charAt(0)}
                {tech.last_name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <span className="font-semibold text-[15px] leading-tight">
                {tech.first_name} {tech.last_name}
              </span>
              {tech.organization_name && (
                <p className="text-xs text-muted-foreground/60">{tech.organization_name}</p>
              )}
            </div>
          </div>
        );
      },
    },
    // Réappro right after name — most actionable info closest to identifier (Hodent)
    {
      id: "restock",
      accessorFn: (row) => {
        const days = daysSince(row.last_restock_at);
        if (days !== null) return days;
        // Jamais reappro : urgent seulement s'il a deja un inventaire. Sans rien
        // en stock, c'est un technicien inactif — il n'a rien a faire en tete de
        // liste, la ou le regard se pose en premier.
        return row.inventory_count > 0 ? 9999 : -1;
      },
      header: ({ column }) => <SortHeader label="Réappro" column={column} />,
      cell: ({ row }) => {
        const days = daysSince(row.original.last_restock_at);
        const label = restockLabel(days);
        const exact = restockDateTime(row.original.last_restock_at);
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-foreground tabular-nums">{exact ?? "Jamais"}</span>
            {exact && <span className="text-xs text-muted-foreground">{label}</span>}
          </div>
        );
      },
      sortingFn: "basic",
      meta: { label: "Réappro" },
    },
    {
      accessorKey: "year_units_total",
      header: ({ column }) => <SortHeader label={yearLabel} column={column} />,
      cell: ({ row }) => {
        const count = row.original.year_units_total;
        return (
          <div className="flex flex-col items-start min-w-[60px]">
            <span
              className={cn(
                "font-heading font-bold tabular-nums text-xl leading-none",
                count === 0 ? "text-muted-foreground/40" : "text-foreground"
              )}
            >
              {count}
            </span>
          </div>
        );
      },
      meta: { label: yearLabel },
    },
    {
      id: "equipment",
      accessorFn: (row) => row.equipment_count ?? 0,
      header: ({ column }) => <SortHeader label="Outillage" column={column} />,
      cell: ({ row }) => {
        const count = row.original.equipment_count ?? 0;
        // A zero, il n'y a rien a consulter : on n'invite pas a cliquer
        if (count === 0) {
          return (
            <span className="font-heading font-bold tabular-nums text-xl text-muted-foreground/40">
              0
            </span>
          );
        }
        return (
          <Link
            href={`/techniciens/${row.original.id}?tab=equipment`}
            onClick={(e) => e.stopPropagation()}
            className="font-heading font-bold tabular-nums text-xl hover:underline underline-offset-4 decoration-2"
          >
            {count}
          </Link>
        );
      },
      meta: { label: "Outillage" },
    },
    {
      id: "vehicle",
      accessorFn: (row) => vehicleByTechnician.get(row.id)?.name ?? "",
      meta: { label: "Véhicule" },
      header: ({ column }) => <SortHeader label="Véhicule" column={column} />,
      cell: ({ row }) => {
        const vehicle = vehicleByTechnician.get(row.original.id);
        if (!vehicle) return <span className="text-muted-foreground">—</span>;
        // vehicle.name vaut déjà « marque modèle » : ne pas le répéter en dessous
        return (
          <Link
            href={`/vehicules/${vehicle.id}`}
            onClick={(e) => e.stopPropagation()}
            className="leading-tight block hover:underline underline-offset-2"
          >
            <span className="text-[15px]">{vehicle.name}</span>
            <span className="block text-xs font-mono tracking-wide text-muted-foreground mt-0.5">
              {vehicle.license_plate}
            </span>
          </Link>
        );
      },
    },
    {
      accessorKey: "city",
      // Le champ en base s'appelle toujours `city`, mais on y saisit le
      // departement d'affectation : c'est ce libelle-la qui est affiche partout.
      meta: { label: "Département" },
      header: ({ column }) => <SortHeader label="Département" column={column} />,
      cell: ({ row }) => <span className="text-[15px]">{row.original.city || "—"}</span>,
    },
    {
      id: "organization",
      meta: { label: "Organisation" },
      accessorFn: (row) => row.organization_name || "",
      header: ({ column }) => <SortHeader label="Organisation" column={column} />,
      cell: ({ row }) => (
        <span className="text-[15px]">{row.original.organization_name || "—"}</span>
      ),
    },
    {
      accessorKey: "phone",
      meta: { label: "Téléphone" },
      header: ({ column }) => <SortHeader label="Téléphone" column={column} />,
      // Cliquable : depuis la liste, le geste utile est d'appeler, pas de lire.
      // L'icone rend l'action lisible — un numero souligne au survol seulement
      // ne se distingue pas du texte tant qu'on ne le survole pas.
      cell: ({ row }) =>
        row.original.phone ? (
          <a
            href={`tel:${row.original.phone.replace(/\s/g, "")}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-[15px] tabular-nums hover:underline underline-offset-2"
          >
            <Phone className="size-3.5 text-muted-foreground shrink-0" />
            {row.original.phone}
          </a>
        ) : (
          <span className="text-[15px] text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "email",
      meta: { label: "Email" },
      header: ({ column }) => <SortHeader label="Email" column={column} />,
      cell: ({ row }) =>
        row.original.email ? (
          <a
            href={`mailto:${row.original.email}`}
            onClick={(e) => e.stopPropagation()}
            className="text-[15px] hover:underline underline-offset-2"
          >
            {row.original.email}
          </a>
        ) : (
          <span className="text-[15px] text-muted-foreground">—</span>
        ),
    },
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      header: () => null,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              setRestockTechId(row.original.id);
            }}
          >
            <Plus className="size-3.5" />
            Réappro
          </Button>
        </div>
      ),
      meta: { align: "right" },
    },
  ];

  const table = useReactTable({
    data: filteredData,
    columns,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting, columnVisibility },
  });

  if (isLoading || isOrgLoading) {
    return (
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Skeleton className="h-9 flex-1 rounded-md" />
          <div className="flex gap-1.5">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-7 w-20 rounded-full" />
            ))}
          </div>
        </div>
        {/* Le squelette doit avoir autant de colonnes que le tableau reel,
            sinon la mise en page saute au moment ou les donnees arrivent.
            7 visibles : Technicien, Reappro, Unites, Outillage, Vehicule,
            Departement, action. */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                {[20, 20, 16, 16, 20, 14, 10].map((w, i) => (
                  <th key={i} className="h-11 px-5 text-left">
                    <Skeleton className="h-3" style={{ width: `${w * 4}px` }} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(6)].map((_, i) => (
                <tr key={i} className="border-b last:border-b-0">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-4">
                      <Skeleton className="size-9 rounded-full" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <Skeleton className="h-4 w-24" />
                  </td>
                  <td className="px-5 py-4">
                    <Skeleton className="h-5 w-8" />
                  </td>
                  <td className="px-5 py-4">
                    <Skeleton className="h-5 w-8" />
                  </td>
                  <td className="px-5 py-4">
                    <Skeleton className="h-4 w-24" />
                  </td>
                  <td className="px-5 py-4">
                    <Skeleton className="h-4 w-16" />
                  </td>
                  <td className="px-5 py-4">
                    <Skeleton className="h-7 w-20 rounded-md ml-auto" />
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
    return (
      <QueryError message="Impossible de charger les techniciens." onRetry={() => refetch()} />
    );
  }

  const filteredCount = filteredData.length;
  const totalCount = technicians.length;

  return (
    <div className="space-y-3">
      {/* Search + year selector + column toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Rechercher un technicien..."
          className="bg-white dark:bg-card"
          wrapperClassName="flex-1"
        />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={selectedYear <= currentYear - 5}
            onClick={() => setSelectedYear((y) => y - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="font-heading text-lg font-bold tabular-nums min-w-[4ch] text-center">
            {selectedYear}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={selectedYear >= currentYear}
            onClick={() => setSelectedYear((y) => y + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <TableColumnToggle table={table} />
      </div>

      {totalCount === 0 ? (
        /* ─── Illustrated empty state ─── */
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-muted mb-4">
              <UserPlus className="size-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Aucun technicien</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Ajoutez vos techniciens pour suivre leur inventaire et planifier les
              réapprovisionnements.
            </p>
            <Button className="mt-5" onClick={() => setCreateOpen(true)}>
              <UserPlus className="mr-2 size-4" />
              Ajouter un technicien
            </Button>
          </div>
        </div>
      ) : (
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
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.original.id}
                    className="group border-b last:border-b-0 cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => router.push(`/techniciens/${row.original.id}`)}
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
                  <td colSpan={columns.length} className="h-32 text-center">
                    <div className="text-muted-foreground">
                      Aucun technicien ne correspond à cette recherche.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer — animated count */}
      {totalCount > 0 && (
        <div className="px-1">
          <p className="text-muted-foreground text-sm">
            <HeroNumber value={filteredCount} className="text-sm" />
            {filteredCount !== totalCount && (
              <span className="tabular-nums"> sur {totalCount}</span>
            )}{" "}
            technicien{totalCount > 1 ? "s" : ""}
          </p>
        </div>
      )}

      {restockTechId && (
        <RestockDialog
          technicianId={restockTechId}
          open={!!restockTechId}
          onOpenChange={(open) => !open && setRestockTechId(null)}
          onSuccess={() => setRestockTechId(null)}
        />
      )}

      <CreateTechnicianDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
