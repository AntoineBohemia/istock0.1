"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Package, ImageIcon, Search, ArrowUpDown, Users, ChevronDown, X } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useTechnicians } from "@/hooks/queries";
import { useTechnicianYearlyTotals } from "@/hooks/queries/use-technicians";

const MotionTr = motion.create("tr");

interface ProductTotal {
  product_id: string;
  product_name: string;
  product_sku: string | null;
  product_image_url: string | null;
  total_quantity: number;
}

interface TechnicianInventoryProps {
  totals: ProductTotal[];
  year: number;
  technicianId: string;
  technicianName: string;
}

type SortKey = "name" | "quantity";
type SortDir = "asc" | "desc";

interface ComparedTechnician {
  id: string;
  name: string;
}

function CompareSelector({
  technicianId,
  compared,
  onToggle,
}: {
  technicianId: string;
  compared: ComparedTechnician[];
  onToggle: (tech: ComparedTechnician) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { currentOrganization } = useOrganizationStore();
  const { data: technicians = [] } = useTechnicians(currentOrganization?.id);

  const comparedIds = new Set(compared.map((c) => c.id));
  const available = technicians.filter((t) => t.id !== technicianId);

  const filtered = filter
    ? available.filter((t) =>
        `${t.first_name} ${t.last_name}`.toLowerCase().includes(filter.toLowerCase())
      )
    : available;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border bg-white dark:bg-card px-3 h-9 text-sm transition-colors",
          compared.length > 0
            ? "border-foreground text-foreground"
            : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
        )}
      >
        <Users className="size-3.5" />
        Comparer
        {compared.length > 0 && (
          <span className="bg-foreground text-background rounded-full size-5 text-xs flex items-center justify-center font-semibold">
            {compared.length}
          </span>
        )}
        <ChevronDown className="size-3.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg border bg-white dark:bg-card shadow-lg overflow-hidden">
            {available.length > 5 && (
              <div className="px-3 pt-3 pb-1">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Filtrer..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="pl-7 h-8 text-sm"
                    autoFocus
                  />
                </div>
              </div>
            )}
            <div className="max-h-56 overflow-y-auto py-1">
              {filtered.map((t) => {
                const checked = comparedIds.has(t.id);
                const name = `${t.first_name} ${t.last_name.charAt(0)}.`;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onToggle({ id: t.id, name })}
                    className="flex w-full items-center gap-2.5 px-3 py-2 hover:bg-muted/60 transition-colors text-left text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      className="rounded-md pointer-events-none data-checked:bg-foreground data-checked:border-foreground"
                      tabIndex={-1}
                    />
                    {t.first_name} {t.last_name}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">Aucun résultat</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function TechnicianInventory({
  totals,
  year,
  technicianId,
  technicianName,
}: TechnicianInventoryProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("quantity");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [compared, setCompared] = useState<ComparedTechnician[]>([]);
  const prefersReducedMotion = useReducedMotion();

  const toggleCompare = (tech: ComparedTechnician) => {
    setCompared((prev) =>
      prev.find((c) => c.id === tech.id)
        ? prev.filter((c) => c.id !== tech.id)
        : [...prev, tech]
    );
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "quantity" ? "desc" : "asc");
    }
  };

  const filtered = useMemo(() => {
    let items = totals;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (item) =>
          item.product_name.toLowerCase().includes(q) ||
          (item.product_sku && item.product_sku.toLowerCase().includes(q))
      );
    }
    return [...items].sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") {
        return mul * a.product_name.localeCompare(b.product_name);
      }
      return mul * (a.total_quantity - b.total_quantity);
    });
  }, [totals, search, sortKey, sortDir]);

  const grandTotal = filtered.reduce((sum, item) => sum + item.total_quantity, 0);
  const productIds = filtered.map((f) => f.product_id);
  const isComparing = compared.length > 0;

  if (totals.length === 0) {
    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-muted mb-4">
            <Package className="size-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">Aucune sortie en {year}</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Aucun produit n&apos;a été sorti vers ce technicien cette année.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search + Compare selector */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white dark:bg-card"
          />
        </div>
        <CompareSelector
          technicianId={technicianId}
          compared={compared}
          onToggle={toggleCompare}
        />
      </div>

      {/* Compared chips */}
      {isComparing && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {compared.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleCompare(c)}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/80 transition-colors"
            >
              {c.name}
              <X className="size-3 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      {/* Summary */}
      <p className="text-sm text-muted-foreground tabular-nums">
        {filtered.length} produit{filtered.length > 1 ? "s" : ""} ·{" "}
        <span className="font-heading font-semibold text-foreground">{grandTotal}</span> unités en{" "}
        {year}
      </p>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="h-11 px-5 text-left">
                <button
                  type="button"
                  onClick={() => toggleSort("name")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/50 hover:text-foreground transition-colors select-none"
                >
                  Produit
                  <ArrowUpDown
                    className={cn(
                      "size-3 transition-colors",
                      sortKey === "name" ? "text-foreground" : "text-foreground/25"
                    )}
                  />
                </button>
              </th>
              <th className="h-11 px-3 text-center min-w-[80px]">
                <button
                  type="button"
                  onClick={() => toggleSort("quantity")}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider hover:text-foreground transition-colors select-none",
                    isComparing ? "text-foreground" : "text-foreground/50"
                  )}
                >
                  {isComparing ? technicianName : "Total sorti"}
                  <ArrowUpDown
                    className={cn(
                      "size-3 transition-colors",
                      sortKey === "quantity" ? "text-foreground" : "text-foreground/25"
                    )}
                  />
                </button>
              </th>
              {compared.map((c) => (
                <ComparedColumnHeader key={c.id} tech={c} />
              ))}
              {isComparing && (
                <th className="h-11 px-3 text-center min-w-[60px]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">Δ</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout" initial={false}>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={2 + compared.length + (isComparing ? 1 : 0)} className="h-32 text-center text-muted-foreground">
                    Aucun produit trouvé.
                  </td>
                </tr>
              ) : (
                filtered.map((item, index) => (
                  <ComparisonRow
                    key={item.product_id}
                    item={item}
                    index={index}
                    compared={compared}
                    year={year}
                    isComparing={isComparing}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                ))
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComparedColumnHeader({
  tech,
}: {
  tech: ComparedTechnician;
}) {
  return (
    <th className="h-11 px-3 text-center min-w-[80px]">
      <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
        {tech.name}
      </span>
    </th>
  );
}

function ComparisonRow({
  item,
  index,
  compared,
  year,
  isComparing,
  prefersReducedMotion,
}: {
  item: ProductTotal;
  index: number;
  compared: ComparedTechnician[];
  year: number;
  isComparing: boolean;
  prefersReducedMotion: boolean | null;
}) {
  return (
    <MotionTr
      layout={!prefersReducedMotion}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
      transition={{
        type: "spring",
        bounce: 0,
        duration: 0.35,
        delay: prefersReducedMotion ? 0 : index * 0.03,
      }}
      className="border-b last:border-b-0 transition-colors hover:bg-muted/40"
    >
      <td className="px-5 py-4">
        <Link
          href={`/produits/${item.product_id}`}
          className="flex items-center gap-3 group/link"
        >
          <figure className="flex size-10 items-center justify-center rounded-lg border bg-white dark:bg-card shrink-0 overflow-hidden">
            {item.product_image_url ? (
              <Image
                src={item.product_image_url}
                width={40}
                height={40}
                alt={item.product_name}
                className="size-full object-cover"
              />
            ) : (
              <ImageIcon className="size-5 text-muted-foreground" />
            )}
          </figure>
          <div className="min-w-0">
            <p className="font-semibold text-[15px] group-hover/link:underline decoration-muted-foreground/40 underline-offset-2">
              {item.product_name}
            </p>
            {item.product_sku && (
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                {item.product_sku}
              </p>
            )}
          </div>
        </Link>
      </td>
      <td className="px-3 py-4 text-center">
        <span className={cn(
          "font-heading font-bold tabular-nums",
          isComparing ? "text-lg" : "text-xl"
        )}>
          {item.total_quantity}
        </span>
      </td>
      {compared.map((c) => (
        <ComparedCell key={c.id} techId={c.id} year={year} productId={item.product_id} primaryQty={item.total_quantity} />
      ))}
      {isComparing && (
        <DeltaCell comparedTechIds={compared.map((c) => c.id)} year={year} productId={item.product_id} primaryQty={item.total_quantity} />
      )}
    </MotionTr>
  );
}

function ComparedCell({
  techId,
  year,
  productId,
  primaryQty,
}: {
  techId: string;
  year: number;
  productId: string;
  primaryQty: number;
}) {
  const { data: totals, isLoading } = useTechnicianYearlyTotals(techId, year);

  const qty = useMemo(() => {
    if (!totals) return 0;
    return totals.find((t) => t.product_id === productId)?.total_quantity ?? 0;
  }, [totals, productId]);

  if (isLoading) {
    return (
      <td className="px-3 py-4 text-center">
        <span className="text-muted-foreground/30 text-sm">—</span>
      </td>
    );
  }

  return (
    <td
      className={cn(
        "px-3 py-4 text-center",
        qty > 0 && qty > primaryQty && "bg-green-50 dark:bg-green-950/20",
        qty > 0 && qty < primaryQty && "bg-red-50 dark:bg-red-950/20"
      )}
    >
      <span
        className={cn(
          "tabular-nums text-sm font-medium",
          qty === 0
            ? "text-muted-foreground/30"
            : qty > primaryQty
              ? "text-green-600 dark:text-green-400"
              : qty < primaryQty
                ? "text-red-500 dark:text-red-400"
                : "text-muted-foreground"
        )}
      >
        {qty}
      </span>
    </td>
  );
}

function DeltaCell({
  comparedTechIds,
  year,
  productId,
  primaryQty,
}: {
  comparedTechIds: string[];
  year: number;
  productId: string;
  primaryQty: number;
}) {
  // Use first compared tech for delta (hooks must be called unconditionally)
  const { data: data0 } = useTechnicianYearlyTotals(comparedTechIds[0], year);
  const { data: data1 } = useTechnicianYearlyTotals(comparedTechIds[1] ?? comparedTechIds[0], year);
  const { data: data2 } = useTechnicianYearlyTotals(comparedTechIds[2] ?? comparedTechIds[0], year);
  const { data: data3 } = useTechnicianYearlyTotals(comparedTechIds[3] ?? comparedTechIds[0], year);

  const allData = [data0, data1, data2, data3].slice(0, comparedTechIds.length);
  const otherQties = allData.map((d) => d?.find((t) => t.product_id === productId)?.total_quantity ?? 0);
  const avg = otherQties.reduce((s, v) => s + v, 0) / otherQties.length;
  const delta = Math.round(primaryQty - avg);

  if (delta === 0) {
    return (
      <td className="px-3 py-4 text-center">
        <span className="text-muted-foreground/30 text-xs">=</span>
      </td>
    );
  }

  return (
    <td className="px-3 py-4 text-center">
      <span
        className={cn(
          "tabular-nums text-xs font-semibold rounded-full px-2 py-0.5",
          delta > 0
            ? "text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-950/30"
            : "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-950/30"
        )}
      >
        {delta > 0 ? "+" : ""}{delta}
      </span>
    </td>
  );
}
