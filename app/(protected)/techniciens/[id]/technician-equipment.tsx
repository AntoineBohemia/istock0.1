"use client";

import { useMemo, useState } from "react";
import { Wrench, UserMinus, Search, Plus, Clock, icons } from "lucide-react";
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

function daysSinceAssignment(assignedAt: string): number {
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

const fmtPrice = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function EquipmentIcon({
  iconName,
  iconColor,
  imageUrl,
}: {
  iconName?: string | null;
  iconColor?: string | null;
  imageUrl?: string | null;
}) {
  if (iconName) {
    const LucideIcon = (icons as Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>>)[iconName];
    if (LucideIcon) {
      return (
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: iconColor
              ? `color-mix(in oklch, ${iconColor} 10%, transparent)`
              : "var(--color-muted)",
          }}
        >
          <LucideIcon
            className="size-5"
            style={{ color: iconColor ?? "var(--color-muted-foreground)" }}
          />
        </div>
      );
    }
  }

  if (imageUrl) {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
        <Image src={imageUrl} width={40} height={40} className="size-full rounded-xl object-cover" alt="" />
      </div>
    );
  }

  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
      <Wrench className="size-5 text-muted-foreground" />
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

  const totalItems = useMemo(
    () => equipment.reduce((sum, a) => sum + a.quantity, 0),
    [equipment]
  );

  const handleAssign = () => {
    if (!assigningProduct || !currentOrganization?.id) return;
    assignMutation.mutate(
      { organizationId: currentOrganization.id, productId: assigningProduct, technicianId, quantity: 1 },
      {
        onSuccess: () => { toast.success("Outil assigné"); setAssigningProduct(""); },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur"),
      }
    );
  };

  const handleUnassign = (productId: string, productName: string) => {
    if (!currentOrganization?.id) return;
    unassignMutation.mutate(
      { organizationId: currentOrganization.id, productId, technicianId, quantity: 1 },
      {
        onSuccess: () => toast.success(`${productName} récupéré`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur"),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full rounded-md" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Assign bar */}
      <div className="flex gap-2">
        <select
          value={assigningProduct}
          onChange={(e) => setAssigningProduct(e.target.value)}
          className="border-input bg-white dark:bg-card text-sm flex h-9 flex-1 rounded-md border px-3 py-1.5 shadow-xs outline-none focus:border-foreground/30 focus:ring-foreground/10 focus:ring-[3px]"
        >
          <option value="">Assigner un outil…</option>
          {availableEquipment.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.stock_current ?? 0})
            </option>
          ))}
        </select>
        <Button size="sm" className="h-9" onClick={handleAssign} disabled={!assigningProduct || assignMutation.isPending}>
          Assigner
        </Button>
      </div>

      {equipment.length > 5 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white dark:bg-card" />
        </div>
      )}

      {equipment.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-muted mb-3">
              <Wrench className="size-5 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold">Aucun outil équipé</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
              Utilisez le sélecteur ci-dessus pour assigner un outil à {technicianName}.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <AnimatePresence mode="popLayout" initial={false}>
            {filtered.map((assignment, index) => {
              const product = assignment.product;
              if (!product) return null;
              const days = daysSinceAssignment(assignment.assigned_at);
              return (
                <motion.div
                  key={assignment.id}
                  layout={!prefersReducedMotion}
                  initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.95 }}
                  transition={{
                    type: "spring",
                    bounce: 0,
                    duration: 0.35,
                    delay: prefersReducedMotion ? 0 : index * 0.03,
                  }}
                  className="group flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3 transition-colors hover:bg-muted/30"
                >
                  <EquipmentIcon
                    iconName={product.icon_name}
                    iconColor={product.icon_color}
                    imageUrl={product.image_url}
                  />

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold leading-tight truncate">
                      {product.name}
                      {assignment.quantity > 1 && (
                        <span className="ml-1 text-[11px] font-bold text-muted-foreground tabular-nums">
                          x{assignment.quantity}
                        </span>
                      )}
                    </p>
                    <p className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground leading-none">
                      <Clock className="size-2.5 shrink-0" />
                      {formatDuration(days)}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleUnassign(product.id, product.name)}
                    disabled={unassignMutation.isPending}
                    title="Récupérer"
                  >
                    <UserMinus className="size-3.5" />
                  </Button>
                </motion.div>
              );
            })}

            {/* Add slot */}
            {availableEquipment.length > 0 && (
              <motion.button
                key="add-slot"
                layout={!prefersReducedMotion}
                initial={prefersReducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: prefersReducedMotion ? 0 : filtered.length * 0.03 + 0.06 }}
                type="button"
                onClick={() => document.querySelector<HTMLSelectElement>("select")?.focus()}
                className="flex items-center gap-3 rounded-xl border border-dashed border-foreground/8 px-3.5 py-3 hover:border-foreground/15 hover:bg-muted/10 transition-colors cursor-pointer"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-foreground/[0.03]">
                  <Plus className="size-4 text-muted-foreground/30" />
                </div>
                <span className="text-xs text-muted-foreground/40">Ajouter un outil</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Footer */}
      {equipment.length > 0 && (
        <p className="text-muted-foreground text-sm px-1">
          <span className="font-heading font-semibold tabular-nums text-foreground">{totalItems}</span>{" "}
          outil{totalItems > 1 ? "s" : ""} équipé{totalItems > 1 ? "s" : ""}
          {totalValue > 0 && <span> · {fmtPrice(totalValue)}</span>}
        </p>
      )}
    </div>
  );
}
