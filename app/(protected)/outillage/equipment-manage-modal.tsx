"use client";

import { useState } from "react";
import { Clock, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useTechnicians, useEquipmentProduct } from "@/hooks/queries";
import { useAssignEquipment, useUnassignEquipment } from "@/hooks/mutations";
import { EquipmentProduct } from "@/lib/supabase/queries/equipment";
import ProductIconDisplay from "@/components/product-icon-display";
import { cn } from "@/lib/utils";

// ── Age helpers ──

type AgeTier = "fresh" | "normal" | "aging" | "old";

function daysSince(d: string): number {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
}

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

function formatDuration(days: number): string {
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "1 jour";
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

// ── Component ──

interface EquipmentManageModalProps {
  product: EquipmentProduct;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}

export default function EquipmentManageModal({
  product,
  open,
  onOpenChange,
  onEdit,
}: EquipmentManageModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const { currentOrganization } = useOrganizationStore();
  const { data: technicians = [] } = useTechnicians(currentOrganization?.id);
  // Live data — re-fetched after each assign/unassign via query invalidation
  const { data: liveProduct } = useEquipmentProduct(product.id);
  const assignMutation = useAssignEquipment();
  const unassignMutation = useUnassignEquipment();

  const [assigningTech, setAssigningTech] = useState("");
  const [showAssignPicker, setShowAssignPicker] = useState(false);

  // Use live data when available, fallback to prop for initial render
  const p = liveProduct ?? product;

  const activeTechs = technicians.filter((t) => !t.archived_at);
  const stock = p.stock_current ?? 0;
  const totalUnits = stock + p.total_assigned;
  const totalValue = (p.price ?? 0) * totalUnits;

  // Build holder data sorted by age (oldest first = most urgent)
  const holders = p.assignments
    .filter((a) => a.technician)
    .map((a) => {
      const days = daysSince(a.assigned_at);
      return { ...a, days, tier: getAgeTier(days) };
    })
    .sort((a, b) => b.days - a.days);

  const handleAssign = () => {
    if (!assigningTech || !currentOrganization?.id || stock <= 0) return;
    const tech = activeTechs.find((t) => t.id === assigningTech);
    if (!tech) return;
    const name = `${tech.first_name} ${tech.last_name}`;
    setAssigningTech("");
    assignMutation.mutate(
      {
        organizationId: currentOrganization.id,
        productId: p.id,
        technicianId: assigningTech,
        quantity: 1,
      },
      {
        onSuccess: () => toast.success(`${p.name} assigne a ${name}`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur"),
      }
    );
  };

  const handleUnassign = (technicianId: string, techName: string) => {
    if (!currentOrganization?.id) return;
    unassignMutation.mutate(
      {
        organizationId: currentOrganization.id,
        productId: p.id,
        technicianId,
        quantity: 1,
      },
      {
        onSuccess: () => toast.success(`${p.name} recupere de ${techName}`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0 flex flex-col max-h-[85vh]">
        {/* ── Header ── */}
        <DialogHeader className="px-5 pt-5 pb-0">
          <div className="flex items-start gap-3">
            <ProductIconDisplay
              iconName={p.icon_name}
              iconColor={p.icon_color}
              imageUrl={p.image_url}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-bold leading-tight truncate">
                {p.name}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{p.sku}</p>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onEdit();
                }}
                className="inline-flex items-center gap-1 mt-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Pencil className="size-2.5" />
                Modifier
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* ── Stats line ── */}
        <div className="px-5 py-3">
          <p className="text-sm text-muted-foreground">
            <span
              className={cn(
                "font-semibold tabular-nums",
                stock === 0 ? "text-attention" : "text-foreground"
              )}
            >
              {stock}
            </span>{" "}
            en stock
            {" · "}
            <span className="font-semibold text-foreground tabular-nums">
              {product.total_assigned}
            </span>{" "}
            assigne{product.total_assigned > 1 ? "s" : ""}
            {totalValue > 0 && (
              <>
                {" "}
                · <span className="tabular-nums">{fmtPrice(totalValue)}</span>
              </>
            )}
          </p>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto border-t px-5 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/40">
              Detenteurs
            </p>
            {holders.length > 0 && (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {holders.length} technicien{holders.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {holders.length === 0 && !showAssignPicker && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun technicien ne detient cet outil
            </p>
          )}

          <div className="space-y-1">
            <AnimatePresence mode="popLayout" initial={false}>
              {holders.map((a) => {
                const tech = a.technician!;
                const initials =
                  `${tech.first_name.charAt(0)}${tech.last_name.charAt(0)}`.toUpperCase();
                const fullName = `${tech.first_name} ${tech.last_name}`;

                return (
                  <motion.div
                    key={a.id}
                    layout={!prefersReducedMotion}
                    initial={prefersReducedMotion ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0, x: 8, height: 0 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                    className="rounded-lg bg-foreground/[0.02] p-3 space-y-2"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8 shrink-0">
                        {tech.photo_url && <AvatarImage src={tech.photo_url} />}
                        <AvatarFallback className="text-[10px] font-semibold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/techniciens/${tech.id}`}
                          className="text-sm font-medium hover:underline truncate block"
                        >
                          {fullName}
                        </Link>
                      </div>
                      {a.quantity > 1 && (
                        <span className="text-[11px] font-bold tabular-nums bg-foreground/[0.06] px-1.5 py-0.5 rounded shrink-0">
                          x{a.quantity}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleUnassign(tech.id, fullName)}
                        disabled={unassignMutation.isPending}
                      >
                        Recuperer
                      </Button>
                    </div>

                    {/* Age bar */}
                    <div className="pl-11 space-y-0.5">
                      <div className="h-1.5 rounded-full bg-foreground/[0.05] overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            ageBarColor[a.tier]
                          )}
                          style={{ width: `${Math.max(Math.min((a.days / 365) * 100, 100), 4)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="size-2.5" />
                          {formatDuration(a.days)}
                        </span>
                        {a.tier === "aging" && (
                          <span className="text-[10px] text-attention font-medium">A verifier</span>
                        )}
                        {a.tier === "old" && (
                          <span className="text-[10px] text-destructive font-medium">
                            Depuis longtemps
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* ── "+" add holder — inline at end of list ── */}
            {stock > 0 && activeTechs.length > 0 && (
              <AnimatePresence mode="wait">
                {showAssignPicker ? (
                  <motion.div
                    key="picker"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-lg border border-dashed border-foreground/[0.12] p-3 space-y-2">
                      <select
                        value={assigningTech}
                        onChange={(e) => setAssigningTech(e.target.value)}
                        autoFocus
                        className="border-input bg-white dark:bg-card text-sm flex h-9 w-full rounded-md border px-3 py-1.5 shadow-xs outline-none focus:border-foreground/30 focus:ring-foreground/10 focus:ring-[3px]"
                      >
                        <option value="">Choisir un technicien...</option>
                        {activeTechs.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.first_name} {t.last_name}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 flex-1 text-xs"
                          onClick={() => {
                            setShowAssignPicker(false);
                            setAssigningTech("");
                          }}
                        >
                          Annuler
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 flex-1 text-xs"
                          onClick={() => {
                            handleAssign();
                            setShowAssignPicker(false);
                          }}
                          disabled={!assigningTech || assignMutation.isPending}
                        >
                          Assigner
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.button
                    key="add-btn"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    type="button"
                    onClick={() => setShowAssignPicker(true)}
                    className="w-full flex items-center gap-3 rounded-lg border border-dashed border-foreground/[0.10] p-3 hover:border-foreground/20 hover:bg-muted/20 transition-colors cursor-pointer"
                  >
                    <div className="flex size-8 items-center justify-center rounded-full bg-foreground/[0.04]">
                      <Plus className="size-4 text-muted-foreground/40" />
                    </div>
                    <span className="text-sm text-muted-foreground/50">
                      Assigner a un technicien
                    </span>
                  </motion.button>
                )}
              </AnimatePresence>
            )}

            {stock === 0 && holders.length > 0 && (
              <p className="text-[11px] text-attention text-center py-2 font-medium">
                Tout le stock est deploye
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
