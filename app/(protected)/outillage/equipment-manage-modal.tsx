"use client";

import { useState } from "react";
import {
  Archive,
  ChevronDown,
  History,
  Minus,
  Pencil,
  Plus,
  Receipt,
  ShoppingCart,
} from "lucide-react";
import Link from "next/link";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

import { useOrganizationStore } from "@/lib/stores/organization-store";
import {
  useTechnicians,
  useEquipmentProduct,
  useEquipmentHistory,
  useEquipmentPurchases,
  useOrganizations,
} from "@/hooks/queries";
import { useAssignEquipment, useUnassignEquipment } from "@/hooks/mutations";
import {
  EquipmentProduct,
  updateEquipmentPurchaseOrganization,
} from "@/lib/supabase/queries/equipment";
import { activeOrganizations } from "@/lib/supabase/queries/organizations";
import { queryKeys } from "@/lib/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import ProductIconDisplay from "@/components/product-icon-display";
import ArchiveEquipmentButton from "./archive-equipment-button";
import RetireEquipmentUnitsButton from "./retire-equipment-units-button";
import StockEntryModal from "@/components/stock-entry-modal";
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
  const [showPurchases, setShowPurchases] = useState(false);
  const [rebuyOpen, setRebuyOpen] = useState(false);
  const { data: purchases = [], isLoading: isPurchasesLoading } = useEquipmentPurchases(
    showPurchases ? product.id : undefined
  );
  const { data: history = [], isLoading: isHistoryLoading } = useEquipmentHistory(
    showHistory ? product.id : undefined
  );
  /** Quantité à rendre, par technicien (défaut : tout ce qu'il détient) */
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});

  // ── Société d'un achat, corrigeable ──
  // Se tromper de société à la saisie est une faute d'étiquette, pas une
  // erreur de stock : la corriger ne devrait pas obliger à annuler l'achat
  // puis à le ressaisir, ce qui laisserait deux lignes de correction dans
  // l'historique pour rien.
  const queryClient = useQueryClient();
  const { data: allOrgs } = useOrganizations();
  const userOrgs = activeOrganizations(allOrgs ?? []);
  const [movingOrgFor, setMovingOrgFor] = useState<string | null>(null);

  const changePurchaseOrg = async (movementId: string, organizationId: string) => {
    setMovingOrgFor(movementId);
    try {
      await updateEquipmentPurchaseOrganization(movementId, organizationId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.equipment.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.movements.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
      ]);
      toast.success(
        `Achat attribué à ${userOrgs.find((o) => o.id === organizationId)?.name ?? "la société"}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setMovingOrgFor(null);
    }
  };

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
        className="max-w-lg gap-0 p-0 flex flex-col max-h-[85vh]"
      >
        {/* ── En-tête : l'identité seule ──
            Les quatre actions se pressaient ici, à droite du nom, dans une
            fenêtre trop étroite pour les tenir : elles se disputaient la place
            avec le titre et se lisaient comme une barre d'outils sans ordre.
            Elles ont maintenant leur propre rangée, sous l'identité. */}
        <DialogHeader className="px-5 pt-5 pb-0">
          <div className="flex items-start gap-3">
            <ProductIconDisplay
              iconName={p.icon_name}
              iconColor={p.icon_color}
              imageUrl={p.image_url}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-heading text-xl font-bold leading-tight">
                {p.name}
              </DialogTitle>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {p.sku}
                {/* Fournisseur : saisi au formulaire, il n'etait affiche nulle part */}
                {p.supplier?.name && <span> · {p.supplier.name}</span>}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* ── Motif d'archivage ──
            Un motif qu'on ne peut pas relire ne sert a rien : il apparait ici
            des que l'outil est sorti du catalogue. */}
        {p.archived_at && (
          <div className="mx-5 mt-4 rounded-lg border border-attention/30 bg-attention-bg/30 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Archive className="size-3" />
              Archivé —{" "}
              {new Date(p.archived_at).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
            {p.archive_reason ? (
              <p className="mt-1 whitespace-pre-line text-sm">{p.archive_reason}</p>
            ) : (
              // Le dire plutot que de laisser un cadre vide, qui se lirait
              // comme un defaut d affichage.
              <p className="mt-1 text-sm text-muted-foreground">
                Aucun motif renseigne — archive avant que la question ne soit posee.
              </p>
            )}
          </div>
        )}

        {/* ── Actions ──
            Toutes de même poids : aucune n'est le geste principal de cet
            écran — celui-là, « assigner », vit dans la liste des détenteurs,
            à l'endroit où l'on regarde qui détient quoi. */}
        <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
          {/* Sur une fiche archivée, ces gestes n'ont plus d'objet : racheter
              une référence qu'on vient de retirer du catalogue, ou en corriger
              le libellé, revient à la maintenir en service à moitié. Le seul
              geste qui vaille est de la restaurer — ou de la laisser. */}
          {!p.archived_at && (
            <>
              {/* Racheter : le bouton « Entree de stock » n'existait que sur la
                  page Produits, qui n'affiche meme pas l'outillage. */}
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setRebuyOpen(true)}
              >
                <ShoppingCart className="size-3.5" />
                Racheter
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => {
                  onOpenChange(false);
                  onEdit();
                }}
              >
                <Pencil className="size-3.5" />
                Modifier
              </Button>
            </>
          )}
          {/* Retirer quelques exemplaires n'est pas archiver la reference :
              l'un sort deux outils casses, l'autre sort les quinze du
              catalogue. Les deux gestes voisinent ici, nommes distinctement. */}
          {!p.archived_at && (
            <RetireEquipmentUnitsButton
              productId={p.id}
              productName={p.name}
              availableStock={stock}
              orgStock={p.product_organization_stock ?? []}
            />
          )}
          {/* Poussé à droite : archiver ne se range pas avec les gestes du
              quotidien, on ne doit pas le rencontrer en visant « Modifier ». */}
          <span className="ml-auto">
            <ArchiveEquipmentButton
              productId={p.id}
              productName={p.name}
              assignedCount={p.total_assigned}
              stockCount={stock}
              isArchived={p.archived_at !== null}
              onArchived={() => onOpenChange(false)}
            />
          </span>
        </div>

        {/* ── Chiffres clés ──
            Trois nombres de même taille se lisaient comme une grille inerte, où
            rien ne disait lequel répond à la question qu'on se pose en ouvrant
            la fiche. « Disponible » commande tout le reste — c'est lui qui dit
            si l'on peut assigner — il porte donc seul le grand corps ; les deux
            autres l'accompagnent. */}
        <div className="px-5 py-4">
          <div className="flex items-stretch gap-4 rounded-xl border bg-muted/30 px-4 py-3.5">
            <div className="min-w-0">
              <p
                className={cn(
                  "font-heading text-4xl font-bold tabular-nums leading-none",
                  stock === 0 ? "text-attention" : "text-foreground"
                )}
              >
                {stock}
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                disponible{stock > 1 ? "s" : ""}
              </p>
            </div>

            <div className="w-px shrink-0 bg-border" />

            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-muted-foreground">Chez les techniciens</span>
                <span className="font-heading text-lg font-semibold tabular-nums">
                  {p.total_assigned}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-muted-foreground">Parc total</span>
                <span className="font-heading text-lg font-semibold tabular-nums">
                  {totalUnits}
                  {totalValue > 0 && (
                    <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                      {fmtPrice(totalValue)}
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Description — saisie dans le formulaire, elle n'était affichée nulle part */}
          {p.description && (
            <p className="mt-3 text-sm whitespace-pre-line text-muted-foreground">
              {p.description}
            </p>
          )}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto border-t px-5 py-3">
          {/* Un intitulé de section à dix pixels ne se lit pas : il se devine.
              Même corps que les autres titres de la fiche, accentué comme le
              reste de l'application. */}
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50">
              Détenteurs
            </p>
            {holders.length > 0 && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {holders.length} technicien{holders.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {holders.length === 0 && !showAssignPicker && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Aucun technicien ne détient cet outil
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
                    <AvatarFallback className="bg-foreground/[0.08] text-[11px] font-semibold text-foreground/70">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/techniciens/${tech.id}`}
                      className="block truncate text-[15px] font-medium hover:underline"
                    >
                      {fullName}
                    </Link>
                    <span
                      className={cn("text-sm tabular-nums", durationColor)}
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
                      <span className="w-12 text-center text-sm tabular-nums">
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
                    <span className="shrink-0 text-sm text-muted-foreground tabular-nums">×1</span>
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
                    <span className="text-sm font-medium">Quantité</span>
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
                      <span className="text-sm text-muted-foreground tabular-nums ml-1">
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

          {/* ── Achats — quand, a combien, chez qui, avec quelle facture ──
               L'historique ci-dessous ne montre que les prets et les retours :
               on ne voyait nulle part l'achat de l'outil. */}
          <div className="mt-5 border-t pt-4">
            <button
              type="button"
              onClick={() => setShowPurchases((v) => !v)}
              className="flex w-full items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/50 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-foreground/[0.06] shrink-0">
                <Receipt className="size-4" />
              </span>
              <span className="flex-1 min-w-0 text-sm font-semibold">Achats</span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                  !showPurchases && "-rotate-90"
                )}
              />
            </button>

            {showPurchases && (
              <div className="mt-2">
                {isPurchasesLoading ? (
                  <p className="py-2 text-sm text-muted-foreground">Chargement…</p>
                ) : purchases.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">
                    Aucun achat enregistré. Un outil entre en stock par une entrée, avec son prix et
                    son fournisseur.
                  </p>
                ) : (
                  <div className="rounded-lg border divide-y">
                    {purchases.map((pu) => (
                      <div key={pu.id} className="px-3 py-2.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm tabular-nums">
                            {pu.created_at
                              ? new Date(pu.created_at).toLocaleDateString("fr-FR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })
                              : "—"}
                            <span className="text-muted-foreground">
                              {" · "}
                              {pu.quantity} unité{pu.quantity > 1 ? "s" : ""}
                            </span>
                          </span>
                          <span className="font-heading text-sm font-semibold tabular-nums shrink-0">
                            {pu.unit_price != null
                              ? fmtPrice(Number(pu.unit_price) * pu.quantity)
                              : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="text-sm text-muted-foreground truncate">
                            {pu.supplier?.name ?? "Fournisseur non renseigné"}
                          </span>
                          {/* Le numero saisi a l'achat. Plus de facture a
                              ouvrir : la reference se lit sur place. */}
                          {pu.invoice_reference ? (
                            <span className="text-sm font-medium shrink-0">
                              {pu.invoice_reference}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground/60 shrink-0">
                              Sans n&deg; de facture
                            </span>
                          )}
                        </div>

                        {/* Qui a paye — et la correction au meme endroit.
                            Un outil rachete par l'autre societe fait deux
                            lignes, chacune avec la sienne : c'est ce qui
                            permet de lire « SMPR en a pris 2, SEIREN 1 ». */}
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="text-sm text-muted-foreground shrink-0">Payé par</span>
                          {userOrgs.length > 1 ? (
                            <select
                              value={pu.organization_id ?? ""}
                              disabled={movingOrgFor === pu.id}
                              onChange={(e) => changePurchaseOrg(pu.id, e.target.value)}
                              className="border-input bg-white dark:bg-card h-7 rounded-md border px-2 text-sm font-medium outline-none focus:border-foreground/30 focus:ring-foreground/10 focus:ring-[3px] disabled:opacity-50"
                            >
                              {!pu.organization_id && <option value="">Non renseignée</option>}
                              {userOrgs.map((org) => (
                                <option key={org.id} value={org.id}>
                                  {org.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-sm font-medium">
                              {pu.organization?.name ?? "Non renseignée"}
                            </span>
                          )}
                          {movingOrgFor === pu.id && (
                            <span className="text-sm text-muted-foreground">
                              Enregistrement&hellip;
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
              <span className="flex-1 min-w-0 text-sm font-semibold">Historique</span>
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
                  <p className="py-2 text-sm text-muted-foreground">Chargement…</p>
                ) : history.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">
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
                              "flex size-6 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                              isOut
                                ? "bg-attention/15 text-attention"
                                : "bg-standard/15 text-standard"
                            )}
                            title={isOut ? "Assigné" : "Rendu"}
                          >
                            {isOut ? "↑" : "↓"}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm">
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
                          <span className="text-sm text-muted-foreground tabular-nums shrink-0">
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

      {/* Modale d'entree prealablement pointee sur cet outil */}
      <StockEntryModal open={rebuyOpen} onClose={() => setRebuyOpen(false)} productId={p.id} />
    </Dialog>
  );
}
