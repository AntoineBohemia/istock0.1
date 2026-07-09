"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Package, Search, ScanLine } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusPill, StockStatus } from "@/components/ui/status-pill";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useTechnicians } from "@/hooks/queries";
import { useScanDrawerStore } from "@/lib/stores/scan-drawer-store";

function daysSince(dateString: string | null): number | null {
  if (!dateString) return null;
  const diff = Date.now() - new Date(dateString).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function restockLabel(days: number | null): string {
  if (days === null) return "Jamais";
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  return `${days}j`;
}

function restockStatus(days: number | null): StockStatus {
  if (days === null) return "critique";
  if (days > 21) return "critique";
  if (days > 14) return "attention";
  return "standard";
}

export default function MobileTechniciansList() {
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();
  const { data: technicians = [], isLoading } = useTechnicians(currentOrganization?.id);
  const openForTechnician = useScanDrawerStore((s) => s.openForTechnician);
  const prefersReducedMotion = useReducedMotion();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return technicians;
    const q = search.toLowerCase().trim();
    return technicians.filter((t) => {
      const name = `${t.first_name} ${t.last_name}`.toLowerCase();
      return name.includes(q);
    });
  }, [technicians, search]);

  if (isLoading || isOrgLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full rounded-md" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-3">
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <div className="flex gap-2">
                    <Skeleton className="h-3 w-10" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                </div>
                <Skeleton className="h-8 w-24 rounded-[7px]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="sticky top-0 z-10 -mx-4 bg-background px-4 pb-2 pt-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un technicien..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Aucun technicien trouvé</p>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {filtered.map((tech, index) => {
              const days = daysSince(tech.last_restock_at);
              const status = restockStatus(days);
              return (
                <motion.div
                  key={tech.id}
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
                  className="rounded-xl border bg-card p-3"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar + Info */}
                    <Link
                      href={`/users/${tech.id}`}
                      className="flex flex-1 items-center gap-3 min-w-0"
                    >
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback className="text-xs font-semibold">
                          {tech.first_name.charAt(0)}
                          {tech.last_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {tech.first_name} {tech.last_name}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Package className="size-3" />
                            <span className="font-heading tabular-nums font-bold">
                              {tech.inventory_count}
                            </span>
                          </span>
                          <StatusPill status={status} label={restockLabel(days)} />
                        </div>
                      </div>
                    </Link>

                    {/* Restock button */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => openForTechnician(tech.id)}
                    >
                      <ScanLine className="mr-1.5 size-3.5" />
                      Réappro
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
