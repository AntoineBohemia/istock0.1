"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Package, Search, ScanLine } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useTechnicians } from "@/hooks/queries";
import { useScanDrawerStore } from "@/lib/stores/scan-drawer-store";

function daysSince(dateString: string | null): number | null {
  if (!dateString) return null;
  const diff = Date.now() - new Date(dateString).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function restockLabel(days: number | null): string {
  if (days === null) return "Jamais restocké";
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  return `il y a ${days}j`;
}

function urgencyColor(days: number | null): string {
  if (days === null) return "text-red-600 dark:text-red-400";
  if (days > 21) return "text-red-600 dark:text-red-400";
  if (days > 14) return "text-orange-600 dark:text-orange-400";
  return "text-muted-foreground";
}

function urgencyBorder(days: number | null): string {
  if (days === null) return "border-l-red-500";
  if (days > 21) return "border-l-red-500";
  if (days > 14) return "border-l-orange-400";
  return "border-l-transparent";
}

export default function MobileTechniciansList() {
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();
  const { data: technicians = [], isLoading } = useTechnicians(currentOrganization?.id);
  const openForTechnician = useScanDrawerStore((s) => s.openForTechnician);
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
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
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
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aucun technicien trouvé
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((tech) => {
            const days = daysSince(tech.last_restock_at);
            return (
              <div
                key={tech.id}
                className={cn(
                  "rounded-lg border border-l-3 p-3",
                  urgencyBorder(days)
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar + Info */}
                  <Link href={`/users/${tech.id}`} className="flex flex-1 items-start gap-3 min-w-0">
                    <Avatar className="size-9 shrink-0">
                      <AvatarFallback className="text-xs">
                        {tech.first_name.charAt(0)}
                        {tech.last_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {tech.first_name} {tech.last_name}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Package className="size-3" />
                          {tech.inventory_count} items
                        </span>
                        <span className={cn("font-medium", urgencyColor(days))}>
                          {restockLabel(days)}
                        </span>
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
                    Restocker
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
