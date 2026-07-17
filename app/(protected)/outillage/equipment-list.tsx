"use client";

import { useMemo, useState } from "react";
import { useQueryStates, parseAsString } from "nuqs";
import { Search, Wrench, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { HeroNumber } from "@/components/ui/hero-number";

import { EquipmentProduct } from "@/lib/supabase/queries/equipment";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useEquipmentProducts } from "@/hooks/queries";
import ProductIconDisplay from "@/components/product-icon-display";
import { cn } from "@/lib/utils";

import CreateEquipmentDialog from "./create-equipment-dialog";
import EditEquipmentDialog from "./edit-equipment-dialog";
import EquipmentManageModal from "./equipment-manage-modal";

const fmtPrice = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

// ── Alert detection — surfaces CD8 on main view ──

type AlertLevel = "none" | "warning" | "danger";

function getCardAlert(product: EquipmentProduct): AlertLevel {
  let worst: AlertLevel = "none";
  for (const a of product.assignments) {
    const days = Math.floor((Date.now() - new Date(a.assigned_at).getTime()) / 86_400_000);
    if (days >= 365) return "danger";
    if (days >= 180) worst = "warning";
  }
  return worst;
}

const alertDotClass: Record<AlertLevel, string> = {
  none: "",
  warning: "bg-attention",
  danger: "bg-destructive",
};

// ── Sorting ──

type SortKey = "name" | "available" | "value" | "alerts";

function sortEquipment(items: EquipmentProduct[], sortBy: SortKey): EquipmentProduct[] {
  return [...items].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name, "fr");
      case "available":
        return (b.stock_current ?? 0) - (a.stock_current ?? 0);
      case "value": {
        const aVal = (a.price ?? 0) * ((a.stock_current ?? 0) + a.total_assigned);
        const bVal = (b.price ?? 0) * ((b.stock_current ?? 0) + b.total_assigned);
        return bVal - aVal;
      }
      case "alerts": {
        const order: Record<AlertLevel, number> = { danger: 0, warning: 1, none: 2 };
        return order[getCardAlert(a)] - order[getCardAlert(b)];
      }
    }
  });
}

export default function EquipmentList() {
  const prefersReducedMotion = useReducedMotion();
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();

  const [{ search }, setQueryStates] = useQueryStates({
    search: parseAsString.withDefault(""),
  });

  const { data: equipment = [], isLoading } = useEquipmentProducts({
    organizationId: currentOrganization?.id,
    search: search || undefined,
  });

  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [manageProduct, setManageProduct] = useState<EquipmentProduct | null>(null);
  const [editProduct, setEditProduct] = useState<EquipmentProduct | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const sorted = useMemo(() => sortEquipment(equipment, sortBy), [equipment, sortBy]);

  // ── Fleet stats ──
  const stats = useMemo(() => {
    let totalUnits = 0;
    let totalValue = 0;
    let alertCount = 0;
    for (const e of equipment) {
      totalUnits += (e.stock_current ?? 0) + e.total_assigned;
      totalValue += (e.price ?? 0) * ((e.stock_current ?? 0) + e.total_assigned);
      if (getCardAlert(e) !== "none") alertCount++;
    }
    return { totalUnits, totalValue, alertCount };
  }, [equipment]);

  if (isLoading || isOrgLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-9 w-full rounded-md" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const totalCount = equipment.length;

  return (
    <div className="space-y-4">
      {/* ── Fleet strip — one line, essentials only ── */}
      {totalCount > 0 && (
        <div className="rounded-xl border bg-card px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="size-4 text-muted-foreground" />
            <span className="text-sm">
              <span className="font-semibold">{stats.totalUnits}</span> unites
              {stats.totalValue > 0 && (
                <span className="text-muted-foreground"> · {fmtPrice(stats.totalValue)}</span>
              )}
            </span>
          </div>
          {stats.alertCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-attention font-medium">
              <AlertTriangle className="size-3.5" />
              {stats.alertCount} alerte{stats.alertCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* ── Search + filters + sort ── */}
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

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="border-input bg-white dark:bg-card text-xs flex h-8 rounded-md border px-2 py-1 shadow-xs outline-none focus:border-foreground/30 sm:ml-auto shrink-0"
        >
          <option value="name">Tri : Nom</option>
          <option value="available">Tri : Disponible</option>
          <option value="value">Tri : Valeur</option>
          <option value="alerts">Tri : Alertes</option>
        </select>
      </div>

      {/* ── Cards ── */}
      {totalCount === 0 && !search ? (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-muted mb-4">
              <Wrench className="size-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Aucun outillage</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Ajoutez vos outils et equipements pour suivre leur assignation aux techniciens.
            </p>
            <Button className="mt-5" onClick={() => setCreateOpen(true)}>
              <Wrench className="mr-2 size-4" />
              Ajouter un outil
            </Button>
          </div>
        </div>
      ) : totalCount === 0 ? (
        <div className="rounded-xl border bg-card">
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <p className="text-muted-foreground text-sm">
              Aucun outil ne correspond a cette recherche.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {sorted.map((item, index) => {
              const stock = item.stock_current ?? 0;
              const total = stock + item.total_assigned;
              const itemValue = (item.price ?? 0) * total;
              const alert = getCardAlert(item);
              const shown = item.assignments.slice(0, 4);
              const remaining = item.assignments.length - shown.length;

              return (
                <motion.div
                  key={item.id}
                  layout={!prefersReducedMotion}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
                  transition={{
                    type: "spring",
                    bounce: 0,
                    duration: 0.35,
                    delay: prefersReducedMotion ? 0 : index * 0.04,
                  }}
                  className="rounded-xl border bg-card p-4 space-y-3 cursor-pointer transition-colors hover:bg-muted/30 hover:border-foreground/10 active:scale-[0.98]"
                  onClick={() => setManageProduct(item)}
                >
                  {/* Header: icon + name + alert dot */}
                  <div className="flex items-start gap-3">
                    <ProductIconDisplay
                      iconName={item.icon_name}
                      iconColor={item.icon_color}
                      imageUrl={item.image_url}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[15px] leading-tight truncate">
                        {item.name}
                      </p>
                      <p className="text-xs mt-0.5 truncate">
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            stock === 0
                              ? "text-critique"
                              : stock <= 2
                                ? "text-attention"
                                : "text-muted-foreground"
                          )}
                        >
                          {stock}
                        </span>
                        <span className="text-muted-foreground"> en stock · </span>
                        <span className="text-muted-foreground tabular-nums">
                          {item.total_assigned}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          assigne{item.total_assigned > 1 ? "s" : ""}
                        </span>
                      </p>
                    </div>
                    {alert !== "none" && (
                      <span
                        className={cn(
                          "size-2.5 rounded-full shrink-0 mt-1.5",
                          alertDotClass[alert]
                        )}
                        title={alert === "danger" ? "Assignation > 1 an" : "Assignation > 6 mois"}
                      />
                    )}
                  </div>

                  {/* Distribution micro-bar */}
                  {total > 0 && (
                    <div className="h-1 rounded-full bg-foreground/[0.06] overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          stock === 0 ? "bg-attention/50" : "bg-foreground/20"
                        )}
                        style={{ width: `${Math.round((item.total_assigned / total) * 100)}%` }}
                      />
                    </div>
                  )}

                  {/* Footer: avatars + value */}
                  <div className="flex items-center justify-between">
                    {shown.length > 0 ? (
                      <div className="flex items-center -space-x-1.5">
                        {shown.map((a) => {
                          const tech = a.technician;
                          if (!tech) return null;
                          const initials = `${tech.first_name.charAt(0)}${tech.last_name.charAt(0)}`;
                          return (
                            <Avatar
                              key={a.id}
                              className="size-6 border-2 border-card"
                              title={`${tech.first_name} ${tech.last_name} (x${a.quantity})`}
                            >
                              {tech.photo_url && <AvatarImage src={tech.photo_url} />}
                              <AvatarFallback className="text-[8px] font-semibold">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                          );
                        })}
                        {remaining > 0 && (
                          <div className="flex size-6 items-center justify-center rounded-full border-2 border-card bg-muted text-[9px] font-semibold">
                            +{remaining}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/50">Non assigne</span>
                    )}
                    {itemValue > 0 && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {fmtPrice(itemValue)}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ── Footer ── */}
      {totalCount > 0 && (
        <div className="px-1">
          <p className="text-muted-foreground text-sm">
            <HeroNumber value={totalCount} className="text-sm" /> type
            {totalCount > 1 ? "s" : ""} d'outils
          </p>
        </div>
      )}

      {/* ── Modals ── */}
      {manageProduct && (
        <EquipmentManageModal
          product={manageProduct}
          open={!!manageProduct}
          onOpenChange={(open) => !open && setManageProduct(null)}
          onEdit={() => setEditProduct(manageProduct)}
        />
      )}

      {editProduct && (
        <EditEquipmentDialog
          product={editProduct}
          open={!!editProduct}
          onOpenChange={(open) => !open && setEditProduct(null)}
        />
      )}

      <CreateEquipmentDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
