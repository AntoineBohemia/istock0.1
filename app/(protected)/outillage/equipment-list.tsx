"use client";

import { useMemo, useState } from "react";
import { useQueryStates, parseAsString } from "nuqs";
import { Wrench, AlertTriangle, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/search-input";
import { QueryError } from "@/components/query-error";
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

// ── Tri ──
// Le sélecteur de tri a été retiré de l'interface : la liste est triée par nom.

function sortEquipmentByName(items: EquipmentProduct[]): EquipmentProduct[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export default function EquipmentList() {
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();

  const [{ search }, setQueryStates] = useQueryStates({
    search: parseAsString.withDefault(""),
  });

  const {
    data: equipment = [],
    isLoading,
    isError,
    refetch,
  } = useEquipmentProducts({
    organizationId: currentOrganization?.id,
    search: search || undefined,
  });

  const [manageProduct, setManageProduct] = useState<EquipmentProduct | null>(null);
  const [editProduct, setEditProduct] = useState<EquipmentProduct | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [onlyAlerts, setOnlyAlerts] = useState(false);

  const sorted = useMemo(() => {
    const list = onlyAlerts ? equipment.filter((e) => getCardAlert(e) !== "none") : equipment;
    return sortEquipmentByName(list);
  }, [equipment, onlyAlerts]);

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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Skeleton className="size-10 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="size-6 rounded-full" />
                <Skeleton className="size-6 rounded-full" />
                <Skeleton className="h-3 w-16 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return <QueryError message="Impossible de charger l'outillage." onRetry={() => refetch()} />;
  }

  const totalCount = equipment.length;

  return (
    <div className="space-y-4">
      {/* ── Recherche et totaux sur une seule ligne ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={(v) => setQueryStates({ search: v || null })}
          placeholder="Rechercher un outil..."
          className="bg-white dark:bg-card"
          wrapperClassName="flex-1"
        />

        {totalCount > 0 && (
          <div className="flex items-center gap-4 shrink-0">
            <span className="flex items-center gap-2 text-sm">
              <Wrench className="size-4 text-muted-foreground" />
              <span>
                <span className="font-semibold tabular-nums">{stats.totalUnits}</span> unites
                {stats.totalValue > 0 && (
                  <span className="text-muted-foreground tabular-nums">
                    {" · "}
                    {fmtPrice(stats.totalValue)}
                  </span>
                )}
              </span>
            </span>
            {stats.alertCount > 0 && (
              <button
                type="button"
                onClick={() => setOnlyAlerts((v) => !v)}
                title={
                  onlyAlerts ? "Afficher tous les outils" : "N'afficher que les outils en alerte"
                }
                className={cn(
                  "flex items-center gap-1.5 rounded-full h-9 px-3.5 text-[13px] font-semibold transition-all cursor-pointer select-none active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  onlyAlerts
                    ? "bg-attention text-white"
                    : "bg-attention/15 text-attention hover:bg-attention/25"
                )}
              >
                <AlertTriangle className="size-3.5" />
                {stats.alertCount} alerte{stats.alertCount > 1 ? "s" : ""}
              </button>
            )}
          </div>
        )}
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
            <div className="flex size-12 items-center justify-center rounded-2xl bg-muted mb-3">
              <Wrench className="size-5 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">
              Aucun outil ne correspond à cette recherche.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {sorted.map((item) => {
            const stock = item.stock_current ?? 0;
            const total = stock + item.total_assigned;
            const itemValue = (item.price ?? 0) * total;
            const alert = getCardAlert(item);
            const shown = item.assignments.slice(0, 4);
            const remaining = item.assignments.length - shown.length;

            return (
              <div
                key={item.id}
                className="group rounded-xl border bg-card overflow-hidden cursor-pointer transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.99]"
                onClick={() => setManageProduct(item)}
              >
                {/* Photo — repère visuel principal */}
                <div className="relative">
                  <ProductIconDisplay
                    iconName={item.icon_name}
                    iconColor={item.icon_color}
                    imageUrl={item.image_url}
                    size="xl"
                    className="w-full rounded-none border-0"
                  />
                  {alert !== "none" && (
                    <span
                      className={cn(
                        "absolute top-2 left-2 size-3 rounded-full ring-2 ring-background",
                        alertDotClass[alert]
                      )}
                      title={alert === "danger" ? "Assignation > 1 an" : "Assignation > 6 mois"}
                    />
                  )}
                  {/* Modification directe, sans passer par la fenêtre de gestion */}
                  <button
                    type="button"
                    title="Modifier cet outil"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditProduct(item);
                    }}
                    className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-lg border bg-background/95 backdrop-blur shadow-sm transition-colors hover:bg-foreground hover:text-background cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[15px] leading-tight truncate group-hover:text-primary transition-colors">
                      {item.name}
                    </p>
                    {/* Deux chiffres clés, lisibles d'un coup d'œil */}
                    <div className="flex items-baseline gap-2.5 mt-1.5">
                      <span className="flex items-baseline gap-1">
                        <span
                          className={cn(
                            "font-heading font-bold tabular-nums text-lg leading-none",
                            stock === 0
                              ? "text-critique"
                              : stock <= 2
                                ? "text-attention"
                                : "text-foreground"
                          )}
                        >
                          {stock}
                        </span>
                        <span className="text-[11px] text-muted-foreground">dispo.</span>
                      </span>
                      <span className="text-foreground/20">·</span>
                      <span className="flex items-baseline gap-1">
                        <span className="font-heading font-bold tabular-nums text-lg leading-none">
                          {item.total_assigned}
                        </span>
                        <span className="text-[11px] text-muted-foreground">assigne</span>
                      </span>
                    </div>
                  </div>

                  {/* Répartition stock / assigné */}
                  {total > 0 && (
                    <div className="h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          stock === 0 ? "bg-attention/60" : "bg-foreground/25"
                        )}
                        style={{ width: `${Math.round((item.total_assigned / total) * 100)}%` }}
                      />
                    </div>
                  )}

                  {/* Détenteurs — qui a l'outil, lisible sans ouvrir la carte */}
                  <div className="flex items-center justify-between gap-2 border-t pt-2.5">
                    {shown.length > 0 ? (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="flex items-center -space-x-1.5 shrink-0">
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
                            <div className="flex size-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[9px] font-semibold">
                              +{remaining}
                            </div>
                          )}
                        </div>
                        {/* Un seul détenteur : on le nomme. Sinon, on compte. */}
                        <span className="text-[11px] text-muted-foreground truncate">
                          {item.assignments.length === 1 && shown[0]?.technician
                            ? `${shown[0].technician.first_name} ${shown[0].technician.last_name.charAt(0)}.`
                            : `${item.assignments.length} techniciens`}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Non assigne</span>
                    )}
                    {itemValue > 0 && (
                      <span className="text-xs font-medium tabular-nums">
                        {fmtPrice(itemValue)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
