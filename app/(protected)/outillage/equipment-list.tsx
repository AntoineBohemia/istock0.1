"use client";

import { useMemo, useState } from "react";
import { useQueryStates, parseAsString } from "nuqs";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Search, Wrench, UserPlus, Timer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { HeroNumber } from "@/components/ui/hero-number";

import { EquipmentProduct } from "@/lib/supabase/queries/equipment";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useEquipmentProducts } from "@/hooks/queries";
import { useCategories } from "@/hooks/queries";
import ProductIconDisplay from "@/components/product-icon-display";
import { cn } from "@/lib/utils";

import AssignEquipmentModal from "./assign-equipment-modal";
import CreateEquipmentDialog from "./create-equipment-dialog";

// ── Animated table row ──
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

// ── Distribution bar ──
function DistributionBar({
  assigned,
  total,
}: {
  assigned: number;
  total: number;
}) {
  if (total === 0) return null;
  const pct = Math.round((assigned / total) * 100);
  const isFull = assigned === total;
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isFull ? "bg-attention" : "bg-foreground/30"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
        {assigned}/{total}
      </span>
    </div>
  );
}

const fmtPrice = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default function EquipmentList() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();

  const [{ search, category }, setQueryStates] = useQueryStates({
    search: parseAsString.withDefault(""),
    category: parseAsString.withDefault(""),
  });

  const { data: equipment = [], isLoading } = useEquipmentProducts({
    organizationId: currentOrganization?.id,
    search: search || undefined,
    categoryId: category || undefined,
  });

  const { data: categoriesResult } = useCategories(currentOrganization?.id);
  const categories = categoriesResult || [];

  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);
  const [assignProductId, setAssignProductId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // ── Summary stats ──
  const stats = useMemo(() => {
    let totalStock = 0;
    let totalAssigned = 0;
    let totalValue = 0;
    for (const e of equipment) {
      const stock = e.stock_current ?? 0;
      totalStock += stock + e.total_assigned;
      totalAssigned += e.total_assigned;
      totalValue += (e.price ?? 0) * (stock + e.total_assigned);
    }
    return { totalStock, totalAssigned, totalValue };
  }, [equipment]);

  const columns: ColumnDef<EquipmentProduct>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => <SortHeader label="Outil" column={column} />,
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex items-center gap-3">
            <ProductIconDisplay
              iconName={p.icon_name}
              iconColor={p.icon_color}
              imageUrl={p.image_url}
              size="sm"
            />
            <div className="min-w-0">
              <p className="font-semibold text-[15px] leading-tight truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{p.sku}</p>
            </div>
          </div>
        );
      },
    },
    {
      id: "category",
      accessorFn: (row) => row.category?.name || "",
      header: ({ column }) => <SortHeader label="Catégorie" column={column} />,
      cell: ({ row }) => (
        <span className="text-[15px]">{row.original.category?.name || "\u2014"}</span>
      ),
    },
    {
      id: "distribution",
      accessorFn: (row) => row.total_assigned,
      header: ({ column }) => <SortHeader label="Répartition" column={column} />,
      cell: ({ row }) => {
        const p = row.original;
        const total = (p.stock_current ?? 0) + p.total_assigned;
        return <DistributionBar assigned={p.total_assigned} total={total} />;
      },
    },
    {
      accessorKey: "stock_current",
      header: ({ column }) => (
        <SortHeader label="Disponible" column={column} className="justify-center w-full" />
      ),
      cell: ({ row }) => {
        const stock = row.original.stock_current ?? 0;
        return (
          <span
            className={cn(
              "font-heading font-bold tabular-nums text-xl",
              stock === 0 ? "text-muted-foreground/40" : "text-foreground"
            )}
          >
            {stock}
          </span>
        );
      },
      meta: { align: "center" },
    },
    {
      id: "assigned_to",
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
          Équipé par
        </span>
      ),
      enableSorting: false,
      cell: ({ row }) => {
        const assignments = row.original.assignments;
        if (assignments.length === 0) {
          return <span className="text-muted-foreground/50 text-sm">Non assigné</span>;
        }
        const shown = assignments.slice(0, 3);
        const remaining = assignments.length - shown.length;
        return (
          <div className="flex items-center -space-x-1.5">
            {shown.map((a) => {
              const tech = a.technician;
              if (!tech) return null;
              const initials = `${tech.first_name.charAt(0)}${tech.last_name.charAt(0)}`;
              return (
                <Avatar
                  key={a.id}
                  className="size-7 border-2 border-card"
                  title={`${tech.first_name} ${tech.last_name} (x${a.quantity})`}
                >
                  {tech.photo_url && <AvatarImage src={tech.photo_url} />}
                  <AvatarFallback className="text-[9px] font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              );
            })}
            {remaining > 0 && (
              <div className="flex size-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-semibold">
                +{remaining}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      enableSorting: false,
      header: () => null,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              setAssignProductId(row.original.id);
            }}
          >
            <UserPlus className="size-3.5" />
            Assigner
          </Button>
        </div>
      ),
      meta: { align: "right" },
    },
  ];

  const table = useReactTable({
    data: equipment,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
  });

  if (isLoading || isOrgLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full rounded-md" />
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                {[...Array(6)].map((_, i) => (
                  <th key={i} className="h-11 px-5 text-left">
                    <Skeleton className="h-3 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="border-b last:border-b-0">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-8 rounded-lg" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  </td>
                  <td className="px-5 py-4"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-5 py-4"><Skeleton className="h-1.5 w-24 rounded-full" /></td>
                  <td className="px-5 py-4 text-center"><Skeleton className="h-5 w-8 mx-auto" /></td>
                  <td className="px-5 py-4"><Skeleton className="h-7 w-16" /></td>
                  <td className="px-5 py-4"><Skeleton className="h-7 w-20 ml-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const totalCount = equipment.length;

  return (
    <div className="space-y-3">
      {/* ── Summary strip ── */}
      {totalCount > 0 && (
        <div className="flex items-center gap-5 rounded-xl border bg-card px-5 py-3">
          <div className="flex items-center gap-2">
            <Wrench className="size-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Parc outillage</span>
          </div>
          <div className="flex items-center gap-4 ml-auto text-sm">
            <div className="text-muted-foreground">
              <span className="font-heading font-bold text-foreground tabular-nums">
                {stats.totalAssigned}
              </span>
              /{stats.totalStock} assignés
            </div>
            {stats.totalValue > 0 && (
              <div className="text-muted-foreground tabular-nums">
                {fmtPrice(stats.totalValue)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search + category chips */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un outil..."
            value={search}
            onChange={(e) => setQueryStates({ search: e.target.value || null })}
            className="pl-9 bg-white dark:bg-card"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setQueryStates({ category: null })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all select-none",
                !category
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              Tous
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() =>
                  setQueryStates({ category: category === cat.id ? null : cat.id })
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all select-none",
                  category === cat.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {totalCount === 0 && !search && !category ? (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-muted mb-4">
              <Wrench className="size-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Aucun outillage</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Ajoutez vos outils et équipements pour suivre leur assignation aux techniciens.
            </p>
            <Button className="mt-5" onClick={() => setCreateOpen(true)}>
              <Wrench className="mr-2 size-4" />
              Ajouter un outil
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
              <AnimatePresence mode="popLayout" initial={false}>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row, index) => (
                    <AnimatedRow
                      key={row.original.id}
                      index={index}
                      reducedMotion={prefersReducedMotion}
                      onClick={() => router.push(`/outillage/${row.original.id}`)}
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
                        Aucun outil ne correspond à cette recherche.
                      </div>
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}

      {totalCount > 0 && (
        <div className="px-1">
          <p className="text-muted-foreground text-sm">
            <HeroNumber value={totalCount} className="text-sm" /> outil
            {totalCount > 1 ? "s" : ""}
          </p>
        </div>
      )}

      {assignProductId && (
        <AssignEquipmentModal
          productId={assignProductId}
          open={!!assignProductId}
          onOpenChange={(open) => !open && setAssignProductId(null)}
        />
      )}

      <CreateEquipmentDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
