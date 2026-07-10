"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Package, ImageIcon, Search, ArrowUpDown } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
}

type SortKey = "name" | "quantity";
type SortDir = "asc" | "desc";

export default function TechnicianInventory({ totals, year }: TechnicianInventoryProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("quantity");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const prefersReducedMotion = useReducedMotion();

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
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher un produit..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white dark:bg-card"
        />
      </div>

      {/* Summary */}
      <p className="text-sm text-muted-foreground tabular-nums">
        {filtered.length} produit{filtered.length > 1 ? "s" : ""} ·{" "}
        <span className="font-heading font-semibold text-foreground">{grandTotal}</span> unités en{" "}
        {year}
      </p>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
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
              <th className="h-11 px-5 text-center">
                <button
                  type="button"
                  onClick={() => toggleSort("quantity")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/50 hover:text-foreground transition-colors select-none"
                >
                  Total sorti
                  <ArrowUpDown
                    className={cn(
                      "size-3 transition-colors",
                      sortKey === "quantity" ? "text-foreground" : "text-foreground/25"
                    )}
                  />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout" initial={false}>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={2} className="h-32 text-center text-muted-foreground">
                    Aucun produit trouvé.
                  </td>
                </tr>
              ) : (
                filtered.map((item, index) => (
                  <MotionTr
                    key={item.product_id}
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
                        <figure className="flex size-10 items-center justify-center rounded-lg border bg-muted shrink-0 overflow-hidden">
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
                    <td className="px-5 py-4 text-center">
                      <span className="font-heading font-bold tabular-nums text-xl">
                        {item.total_quantity}
                      </span>
                    </td>
                  </MotionTr>
                ))
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}
