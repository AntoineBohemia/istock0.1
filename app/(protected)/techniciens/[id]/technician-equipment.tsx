"use client";

import { useMemo, useState } from "react";
import { Wrench, UserMinus, Clock, icons } from "lucide-react";
import { toast } from "@/lib/toast";

import Image from "next/image";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/search-input";
import { Skeleton } from "@/components/ui/skeleton";

import { useTechnicianEquipment, useAvailableEquipment } from "@/hooks/queries";
import { useAssignEquipment, useUnassignEquipment } from "@/hooks/mutations";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { cn } from "@/lib/utils";

interface TechnicianEquipmentProps {
  technicianId: string;
  technicianName: string;
}

// ── Duration helpers ──

function daysSince(assignedAt: string): number {
  return Math.floor((Date.now() - new Date(assignedAt).getTime()) / 86_400_000);
}

function formatDuration(days: number): string {
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 30) return `${days}j`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mois`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} an${years > 1 ? "s" : ""}`;
  return `${years}a ${rem}m`;
}

// ── Age tier — visual encoding of assignment duration (CD8: loss aversion) ──

type AgeTier = "fresh" | "normal" | "aging" | "old";

function getAgeTier(days: number): AgeTier {
  if (days < 30) return "fresh";
  if (days < 90) return "normal";
  if (days < 180) return "aging";
  return "old";
}

const ageTierLabel: Record<AgeTier, string | null> = {
  fresh: null,
  normal: null,
  aging: "A verifier",
  old: "Depuis longtemps",
};

const ageTierLabelColor: Record<AgeTier, string> = {
  fresh: "",
  normal: "",
  aging: "text-attention",
  old: "text-destructive",
};

const fmtPrice = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

// ── Equipment icon (supports lucide icons, images, fallback) ──

function EquipmentIcon({
  iconName,
  iconColor,
  imageUrl,
}: {
  iconName?: string | null;
  iconColor?: string | null;
  imageUrl?: string | null;
}) {
  const containerClass = "size-12 rounded-2xl";
  const iconClass = "size-6";
  const imgSize = 48;

  if (iconName) {
    const LucideIcon = (
      icons as Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>>
    )[iconName];
    if (LucideIcon) {
      return (
        <div
          className={cn("flex shrink-0 items-center justify-center", containerClass)}
          style={{
            backgroundColor: iconColor
              ? `color-mix(in oklch, ${iconColor} 12%, transparent)`
              : "var(--color-muted)",
          }}
        >
          <LucideIcon
            className={iconClass}
            style={{ color: iconColor ?? "var(--color-muted-foreground)" }}
          />
        </div>
      );
    }
  }

  if (imageUrl) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden bg-muted",
          containerClass
        )}
      >
        <Image
          src={imageUrl}
          width={imgSize}
          height={imgSize}
          className="size-full object-cover"
          alt=""
        />
      </div>
    );
  }

  return (
    <div className={cn("flex shrink-0 items-center justify-center bg-muted", containerClass)}>
      <Wrench className={cn(iconClass, "text-muted-foreground")} />
    </div>
  );
}

export default function TechnicianEquipment({
  technicianId,
  technicianName,
}: TechnicianEquipmentProps) {
  const { currentOrganization } = useOrganizationStore();
  const { data: equipment = [], isLoading } = useTechnicianEquipment(technicianId);
  const { data: availableEquipment = [] } = useAvailableEquipment(currentOrganization?.id);
  const assignMutation = useAssignEquipment();
  const unassignMutation = useUnassignEquipment();

  const [search, setSearch] = useState("");
  const [assigningProduct, setAssigningProduct] = useState("");

  const filtered = search
    ? equipment.filter((a) => a.product?.name.toLowerCase().includes(search.toLowerCase()))
    : equipment;

  const totalValue = useMemo(
    () => equipment.reduce((sum, a) => sum + (a.product?.price ?? 0) * a.quantity, 0),
    [equipment]
  );

  const totalItems = useMemo(() => equipment.reduce((sum, a) => sum + a.quantity, 0), [equipment]);

  const handleAssign = () => {
    if (!assigningProduct || !currentOrganization?.id) return;
    assignMutation.mutate(
      {
        organizationId: currentOrganization.id,
        productId: assigningProduct,
        technicianId,
        quantity: 1,
      },
      {
        onSuccess: () => {
          toast.success("Outil assigne");
          setAssigningProduct("");
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur"),
      }
    );
  };

  const handleUnassign = (productId: string, productName: string) => {
    if (!currentOrganization?.id) return;
    unassignMutation.mutate(
      { organizationId: currentOrganization.id, productId, technicianId, quantity: 1 },
      {
        onSuccess: () => toast.success(`${productName} recupere`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur"),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-full rounded-md" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Skeleton className="size-9 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-7 w-20 rounded-[7px]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Assign bar ── */}
      {availableEquipment.length > 0 && (
        <div className="flex gap-2">
          <select
            value={assigningProduct}
            onChange={(e) => setAssigningProduct(e.target.value)}
            className="border-input bg-white dark:bg-card text-sm flex h-9 flex-1 rounded-md border px-3 py-1.5 outline-none focus:border-foreground/30 focus:ring-foreground/10 focus:ring-[3px]"
          >
            <option value="">Assigner un outil…</option>
            {availableEquipment.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.stock_current ?? 0} dispo.)
              </option>
            ))}
          </select>
          <Button
            size="sm"
            className="h-9"
            onClick={handleAssign}
            disabled={!assigningProduct || assignMutation.isPending}
          >
            Assigner
          </Button>
        </div>
      )}

      {/* ── Search ── */}
      {equipment.length > 5 && (
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Rechercher…"
          className="bg-white dark:bg-card"
        />
      )}

      {/* ── Equipment grid — CD4: ownership, each card = precious item ── */}
      {equipment.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted mb-3">
              <Wrench className="size-6 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold">Aucun outil équipé</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
              Utilisez les outils disponibles ci-dessus pour équiper {technicianName}.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((assignment) => {
            const product = assignment.product;
            if (!product) return null;
            const days = daysSince(assignment.assigned_at);
            const tier = getAgeTier(days);
            const itemValue = (product.price ?? 0) * assignment.quantity;
            const tierLabel = ageTierLabel[tier];

            return (
              <div key={assignment.id} className="rounded-xl border bg-card p-4 space-y-3">
                {/* Top: icon + info + action */}
                <div className="flex items-start gap-3">
                  <EquipmentIcon
                    iconName={product.icon_name}
                    iconColor={product.icon_color}
                    imageUrl={product.image_url}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight truncate">{product.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {assignment.quantity > 1 && (
                        <span className="inline-flex items-center rounded-md bg-foreground/[0.06] px-1.5 py-0.5 text-[11px] font-bold tabular-nums">
                          x{assignment.quantity}
                        </span>
                      )}
                      {itemValue > 0 && (
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {fmtPrice(itemValue)}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Always visible — Hodent: recognition > recall */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={() => handleUnassign(product.id, product.name)}
                    disabled={unassignMutation.isPending}
                    title="Recuperer"
                  >
                    <UserMinus className="size-4" />
                  </Button>
                </div>

                {/* Assignment age — duration + status */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="size-2.5" />
                      {formatDuration(days)}
                    </span>
                    {tierLabel && (
                      <span className={cn("text-[10px] font-medium", ageTierLabelColor[tier])}>
                        {tierLabel}
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
      {equipment.length > 0 && (
        <p className="text-muted-foreground text-sm px-1">
          <span className="font-heading font-semibold tabular-nums text-foreground">
            {totalItems}
          </span>{" "}
          outil{totalItems > 1 ? "s" : ""}
          {totalValue > 0 && <> · {fmtPrice(totalValue)}</>}
        </p>
      )}
    </div>
  );
}
