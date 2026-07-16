"use client";

import { useMemo, useState } from "react";
import { Wrench, UserMinus, Search, Clock, icons } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const ageBarColor: Record<AgeTier, string> = {
  fresh: "bg-standard",
  normal: "bg-foreground/25",
  aging: "bg-attention",
  old: "bg-destructive/70",
};

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

// ── Age Bar — pre-attentive visual cue (Hodent: color encodes meaning instantly) ──

function AgeBar({ days }: { days: number }) {
  const pct = Math.min((days / 365) * 100, 100);
  const tier = getAgeTier(days);
  return (
    <div className="h-1.5 rounded-full bg-foreground/[0.05] overflow-hidden w-full">
      <div
        className={cn("h-full rounded-full transition-all duration-500", ageBarColor[tier])}
        style={{ width: `${Math.max(pct, 4)}%` }}
      />
    </div>
  );
}

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
  const prefersReducedMotion = useReducedMotion();
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
        <div className="grid grid-cols-2 gap-3">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-9 w-full rounded-md" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Stats — CD2: accomplishment, sense of responsibility ── */}
      {equipment.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border bg-card px-4 py-3">
            <p className="font-heading text-2xl font-bold tabular-nums leading-none">
              {totalItems}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              outil{totalItems > 1 ? "s" : ""} equipe{totalItems > 1 ? "s" : ""}
            </p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <p className="font-heading text-2xl font-bold tabular-nums leading-none truncate">
              {totalValue > 0 ? fmtPrice(totalValue) : "\u2014"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">valeur confiee</p>
          </div>
        </div>
      )}

      {/* ── Assign bar ── */}
      {availableEquipment.length > 0 && (
        <div className="flex gap-2">
          <select
            value={assigningProduct}
            onChange={(e) => setAssigningProduct(e.target.value)}
            className="border-input bg-white dark:bg-card text-sm flex h-9 flex-1 rounded-md border px-3 py-1.5 shadow-xs outline-none focus:border-foreground/30 focus:ring-foreground/10 focus:ring-[3px]"
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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white dark:bg-card"
          />
        </div>
      )}

      {/* ── Equipment grid — CD4: ownership, each card = precious item ── */}
      {equipment.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted mb-3">
              <Wrench className="size-6 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold">Aucun outil equipe</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
              Utilisez les outils disponibles ci-dessus pour equiper {technicianName}.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {filtered.map((assignment, index) => {
              const product = assignment.product;
              if (!product) return null;
              const days = daysSince(assignment.assigned_at);
              const tier = getAgeTier(days);
              const itemValue = (product.price ?? 0) * assignment.quantity;
              const tierLabel = ageTierLabel[tier];

              return (
                <motion.div
                  key={assignment.id}
                  layout={!prefersReducedMotion}
                  initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.96 }}
                  transition={{
                    type: "spring",
                    bounce: 0,
                    duration: 0.35,
                    delay: prefersReducedMotion ? 0 : index * 0.04,
                  }}
                  className="rounded-xl border bg-card p-4 space-y-3"
                >
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

                  {/* Age bar — pre-attentive cue (color before text) */}
                  <div className="space-y-1">
                    <AgeBar days={days} />
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
                </motion.div>
              );
            })}
          </AnimatePresence>
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
