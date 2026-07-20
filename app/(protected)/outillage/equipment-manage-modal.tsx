"use client";

import { useState } from "react";
import { ChevronDown, History, Minus, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useTechnicians, useEquipmentProduct, useEquipmentHistory } from "@/hooks/queries";
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

/** Date et heure exactes de l'assignation */
function formatAssignedAt(d: string): string {
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
  const { currentOrganization } = useOrganizationStore();
  // Pass the year so this resolves to the 2-arg get_technicians_with_stats overload
  // (calling without a year is ambiguous in the DB and silently returns nothing)
  const { data: technicians = [] } = useTechnicians(
    currentOrganization?.id,
    new Date().getFullYear()
  );
  // Live data — re-fetched after each assign/unassign via query invalidation
  const { data: liveProduct } = useEquipmentProduct(product.id);
  const assignMutation = useAssignEquipment();
  const unassignMutation = useUnassignEquipment();

  const [assigningTech, setAssigningTech] = useState("");
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [assignQty, setAssignQty] = useState(1);
  const [showHistory, setShowHistory] = useState(false);
  const { data: history = [], isLoading: isHistoryLoading } = useEquipmentHistory(
    showHistory ? product.id : undefined
  );
  /** Quantité à rendre, par technicien (défaut : tout ce qu'il détient) */
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});

  // Use live data when available, fallback to prop for initial render
  const p = liveProduct ?? product;

  const activeTechs = technicians.filter((t) => !t.archived_at);
  const stock = p.stock_current ?? 0;
  const totalUnits = stock + p.total_assigned;
  const totalValue = (p.price ?? 0) * totalUnits;

  // Assign entry point is always shown; disabled with a reason when it can't be used
  const canAssign = stock > 0 && activeTechs.length > 0;
  const assignDisabledReason =
    activeTechs.length === 0
      ? "Aucun technicien — créez-en un d'abord"
      : stock <= 0
        ? "Plus de stock disponible pour assigner"
        : null;

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
    const qty = Math.min(Math.max(1, assignQty), stock);
    setAssigningTech("");
    setAssignQty(1);
    assignMutation.mutate(
      {
        organizationId: currentOrganization.id,
        productId: p.id,
        technicianId: assigningTech,
        quantity: qty,
      },
      {
        onSuccess: () => toast.success(`${qty} × ${p.name} assigne a ${name}`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur"),
      }
    );
  };

  const handleUnassign = (technicianId: string, techName: string, quantity: number) => {
    if (!currentOrganization?.id) return;
    unassignMutation.mutate(
      {
        organizationId: currentOrganization.id,
        productId: p.id,
        technicianId,
        quantity,
      },
      {
        onSuccess: () => {
          setReturnQty((prev) => {
            const next = { ...prev };
            delete next[technicianId];
            return next;
          });
          toast.success(`${quantity} × ${p.name} recupere de ${techName}`);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Pas de croix : elle chevauchait le bouton « Modifier ». Échap et le clic
          en dehors ferment la fenêtre, comme partout ailleurs. */}
      <DialogContent
        showCloseButton={false}
        className="max-w-md gap-0 p-0 flex flex-col max-h-[85vh]"
      >
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
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs shrink-0"
              onClick={() => {
                onOpenChange(false);
                onEdit();
              }}
            >
              <Pencil className="size-3.5" />
              Modifier
            </Button>
          </div>
        </DialogHeader>

        {/* ── Chiffres clés ── */}
        <div className="px-5 py-3">
          <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3">
            <div>
              <p
                className={cn(
                  "font-heading text-2xl font-bold tabular-nums leading-none",
                  stock === 0 ? "text-attention" : "text-foreground"
                )}
              >
                {stock}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                disponible{stock > 1 ? "s" : ""}
              </p>
            </div>
            <div>
              <p className="font-heading text-2xl font-bold tabular-nums leading-none">
                {product.total_assigned}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                assigne{product.total_assigned > 1 ? "s" : ""}
              </p>
            </div>
            <div>
              <p className="font-heading text-2xl font-bold tabular-nums leading-none">
                {totalUnits}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                au total{totalValue > 0 ? ` · ${fmtPrice(totalValue)}` : ""}
              </p>
            </div>
          </div>

          {/* Description — saisie dans le formulaire, elle n'était affichée nulle part */}
          {p.description && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
              <p className="text-sm text-foreground whitespace-pre-line">{p.description}</p>
            </div>
          )}
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

          <div className="divide-y">
            {holders.map((a) => {
              const tech = a.technician!;
              const initials =
                `${tech.first_name.charAt(0)}${tech.last_name.charAt(0)}`.toUpperCase();
              const fullName = `${tech.first_name} ${tech.last_name}`;

              const durationColor =
                a.tier === "old"
                  ? "text-destructive"
                  : a.tier === "aging"
                    ? "text-attention"
                    : "text-muted-foreground";

              // Par défaut on rend tout ce que le technicien détient
              const toReturn = Math.min(returnQty[tech.id] ?? a.quantity, a.quantity);

              return (
                <div key={a.id} className="flex items-center gap-2.5 py-3">
                  <Avatar className="size-8 shrink-0 bg-foreground/[0.08]">
                    {tech.photo_url && <AvatarImage src={tech.photo_url} />}
                    <AvatarFallback className="text-[10px] font-semibold bg-foreground/[0.08] text-foreground/70">
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
                    <span
                      className={cn("text-[11px] tabular-nums", durationColor)}
                      title={`Assigné depuis ${formatDuration(a.days)}`}
                    >
                      {formatAssignedAt(a.assigned_at)}
                    </span>
                  </div>

                  {/* Combien il en détient, et combien on lui reprend */}
                  {a.quantity > 1 ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        aria-label="Rendre moins"
                        onClick={() =>
                          setReturnQty((prev) => ({
                            ...prev,
                            [tech.id]: Math.max(1, toReturn - 1),
                          }))
                        }
                        disabled={toReturn <= 1}
                        className="flex size-7 items-center justify-center rounded-md border bg-background hover:bg-muted active:scale-95 transition-all disabled:opacity-30 cursor-pointer"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="w-10 text-center text-xs tabular-nums">
                        <span className="font-bold">{toReturn}</span>
                        <span className="text-muted-foreground">/{a.quantity}</span>
                      </span>
                      <button
                        type="button"
                        aria-label="Rendre plus"
                        onClick={() =>
                          setReturnQty((prev) => ({
                            ...prev,
                            [tech.id]: Math.min(a.quantity, toReturn + 1),
                          }))
                        }
                        disabled={toReturn >= a.quantity}
                        className="flex size-7 items-center justify-center rounded-md border bg-background hover:bg-muted active:scale-95 transition-all disabled:opacity-30 cursor-pointer"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">×1</span>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/50"
                    onClick={() => handleUnassign(tech.id, fullName, toReturn)}
                    disabled={unassignMutation.isPending}
                  >
                    Retirer
                  </Button>
                </div>
              );
            })}

            {/* ── Assign entry point — always visible when a tool is opened ── */}
            {showAssignPicker && canAssign ? (
              <div key="picker" className="overflow-hidden">
                <div className="rounded-lg border border-foreground/20 bg-muted/30 p-3 mt-3 space-y-3">
                  <select
                    value={assigningTech}
                    onChange={(e) => setAssigningTech(e.target.value)}
                    autoFocus
                    className="border-input bg-white dark:bg-card text-sm flex h-9 w-full rounded-md border px-3 py-1.5 outline-none focus:border-foreground/30 focus:ring-foreground/10 focus:ring-[3px]"
                  >
                    <option value="">Choisir un technicien...</option>
                    {activeTechs.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.first_name} {t.last_name}
                      </option>
                    ))}
                  </select>

                  {/* Quantité à assigner — plafonnée au stock disponible */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Quantité</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Diminuer la quantité"
                        onClick={() => setAssignQty((q) => Math.max(1, q - 1))}
                        disabled={assignQty <= 1}
                        className="flex size-8 items-center justify-center rounded-lg border bg-background hover:bg-muted active:scale-95 transition-all disabled:opacity-30 cursor-pointer"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-9 text-center font-heading font-bold tabular-nums">
                        {assignQty}
                      </span>
                      <button
                        type="button"
                        aria-label="Augmenter la quantité"
                        onClick={() => setAssignQty((q) => Math.min(stock, q + 1))}
                        disabled={assignQty >= stock}
                        className="flex size-8 items-center justify-center rounded-lg border bg-background hover:bg-muted active:scale-95 transition-all disabled:opacity-30 cursor-pointer"
                      >
                        <Plus className="size-3.5" />
                      </button>
                      <span className="text-[11px] text-muted-foreground tabular-nums ml-1">
                        / {stock}
                      </span>
                    </div>
                  </div>

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
              </div>
            ) : (
              <button
                key="add-btn"
                type="button"
                onClick={() => canAssign && setShowAssignPicker(true)}
                disabled={!canAssign}
                title={assignDisabledReason ?? undefined}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg border p-3 mt-3 transition-colors text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  canAssign
                    ? "border-foreground/15 bg-muted/40 hover:bg-muted cursor-pointer"
                    : "border-attention/30 bg-attention/[0.05] cursor-not-allowed"
                )}
              >
                <div
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full",
                    canAssign ? "bg-foreground/[0.08]" : "bg-attention/15"
                  )}
                >
                  <Plus
                    className={cn("size-4", canAssign ? "text-foreground" : "text-attention")}
                  />
                </div>
                <span
                  className={cn(
                    "text-sm font-medium",
                    canAssign ? "text-foreground" : "text-attention"
                  )}
                >
                  {canAssign ? "Assigner a un technicien" : assignDisabledReason}
                </span>
              </button>
            )}
          </div>

          {/* ── Historique — qui a eu cet outil, et quand ── */}
          <div className="mt-5 border-t pt-4">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="flex w-full items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/50 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-foreground/[0.06] shrink-0">
                <History className="size-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold">Historique</span>
                <span className="block text-[11px] text-muted-foreground">
                  Qui a eu cet outil, et quand
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                  !showHistory && "-rotate-90"
                )}
              />
            </button>

            {showHistory && (
              <div className="mt-2">
                {isHistoryLoading ? (
                  <p className="text-xs text-muted-foreground py-2">Chargement…</p>
                ) : history.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    Aucun mouvement enregistré pour cet outil.
                  </p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {history.map((h) => {
                      const isOut = h.movement_type === "assign_equipment";
                      return (
                        <li key={h.id} className="flex items-center gap-2 px-3 py-2">
                          <span
                            className={cn(
                              "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                              isOut
                                ? "bg-attention/15 text-attention"
                                : "bg-standard/15 text-standard"
                            )}
                            title={isOut ? "Assigné" : "Rendu"}
                          >
                            {isOut ? "↑" : "↓"}
                          </span>
                          <span className="text-xs flex-1 min-w-0 truncate">
                            <span className="font-medium">
                              {h.technician
                                ? `${h.technician.first_name} ${h.technician.last_name}`
                                : "Technicien supprimé"}
                            </span>
                            <span className="text-muted-foreground">
                              {isOut ? " a reçu " : " a rendu "}
                            </span>
                            <span className="font-medium tabular-nums">{h.quantity}</span>
                          </span>
                          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                            {h.created_at ? formatAssignedAt(h.created_at) : "—"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
