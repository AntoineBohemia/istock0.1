"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, Wrench, icons } from "lucide-react";
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

const fmtPrice = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** Date et heure exactes, comme sur la page Outillage */
const fmtAssignedAt = (d: string) =>
  new Date(d).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

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
  const [assignQty, setAssignQty] = useState(1);
  /** Quantite a rendre, par assignation (defaut : tout ce qu'il detient) */
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});

  // La reference doit etre cherchable comme le nom : c'est souvent elle
  // qu'on a sous les yeux sur l'etiquette de l'outil.
  const filtered = search
    ? equipment.filter((a) => {
        const q = search.toLowerCase();
        return (
          a.product?.name.toLowerCase().includes(q) || a.product?.sku?.toLowerCase().includes(q)
        );
      })
    : equipment;

  // Stock disponible de l'outil selectionne, pour borner le pas de quantite
  const selectedAvailable = availableEquipment.find((p) => p.id === assigningProduct);
  const maxAssignable = selectedAvailable?.stock_current ?? 1;

  const totalValue = useMemo(
    () => equipment.reduce((sum, a) => sum + (a.product?.price ?? 0) * a.quantity, 0),
    [equipment]
  );

  const totalItems = useMemo(() => equipment.reduce((sum, a) => sum + a.quantity, 0), [equipment]);

  const handleAssign = () => {
    if (!assigningProduct || !currentOrganization?.id) return;
    const qty = Math.min(Math.max(1, assignQty), maxAssignable);
    assignMutation.mutate(
      {
        organizationId: currentOrganization.id,
        productId: assigningProduct,
        technicianId,
        quantity: qty,
      },
      {
        onSuccess: () => {
          toast.success(`${qty} outil${qty > 1 ? "s" : ""} assigné${qty > 1 ? "s" : ""}`);
          setAssigningProduct("");
          setAssignQty(1);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur"),
      }
    );
  };

  const handleUnassign = (
    assignmentId: string,
    productId: string,
    productName: string,
    quantity: number
  ) => {
    if (!currentOrganization?.id) return;
    unassignMutation.mutate(
      { organizationId: currentOrganization.id, productId, technicianId, quantity },
      {
        onSuccess: () => {
          setReturnQty((prev) => {
            const next = { ...prev };
            delete next[assignmentId];
            return next;
          });
          toast.success(`${quantity} × ${productName} récupéré`);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur"),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-full rounded-md" />
        {/* Meme nombre de colonnes que la grille reelle, sinon la mise en page
            saute quand les donnees arrivent. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
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
      {/* ── Assignation ──
           Le bloc entier disparaissait quand aucun outil n'avait de stock :
           on ne savait pas si la fonction manquait ou si rien n'etait
           disponible. Il reste visible, desactive, avec sa raison. */}
      <div className="rounded-xl border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={assigningProduct}
            onChange={(e) => {
              setAssigningProduct(e.target.value);
              setAssignQty(1);
            }}
            disabled={availableEquipment.length === 0}
            className="border-input bg-white dark:bg-card text-sm flex h-9 flex-1 min-w-[180px] rounded-md border px-3 py-1.5 outline-none focus:border-foreground/30 focus:ring-foreground/10 focus:ring-[3px] disabled:opacity-50"
          >
            <option value="">Assigner un outil…</option>
            {availableEquipment.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.stock_current ?? 0} dispo.)
              </option>
            ))}
          </select>

          {/* Quantite : elle etait figee a 1, il fallait repeter l'operation */}
          <div className="flex items-center rounded-md border bg-white dark:bg-card h-9">
            <button
              type="button"
              disabled={!assigningProduct || assignQty <= 1}
              onClick={() => setAssignQty((q) => Math.max(1, q - 1))}
              className="px-2.5 h-full text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
              aria-label="Diminuer la quantité"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="w-8 text-center text-sm font-semibold tabular-nums">{assignQty}</span>
            <button
              type="button"
              disabled={!assigningProduct || assignQty >= maxAssignable}
              onClick={() => setAssignQty((q) => Math.min(maxAssignable, q + 1))}
              className="px-2.5 h-full text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
              aria-label="Augmenter la quantité"
            >
              <Plus className="size-3.5" />
            </button>
          </div>

          <Button
            size="sm"
            className="h-9"
            onClick={handleAssign}
            disabled={!assigningProduct || assignMutation.isPending}
          >
            Assigner
          </Button>
        </div>
        {availableEquipment.length === 0 && (
          <p className="text-xs text-muted-foreground mt-2">Aucun outil disponible en stock.</p>
        )}
      </div>

      {/* ── Recherche + total sur une ligne ──
           La recherche etait masquee sous 6 outils : elle apparaissait et
           disparaissait, et la mise en page sautait. */}
      {equipment.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Rechercher un outil…"
              className="bg-white dark:bg-card"
            />
          </div>
          <p className="text-muted-foreground text-sm shrink-0">
            <span className="font-heading font-semibold tabular-nums text-foreground">
              {totalItems}
            </span>{" "}
            outil{totalItems > 1 ? "s" : ""}
            {totalValue > 0 && <> · {fmtPrice(totalValue)}</>}
          </p>
        </div>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((assignment) => {
            const product = assignment.product;
            if (!product) return null;
            const itemValue = (product.price ?? 0) * assignment.quantity;

            return (
              <div key={assignment.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <EquipmentIcon
                    iconName={product.icon_name}
                    iconColor={product.icon_color}
                    imageUrl={product.image_url}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight truncate">{product.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {/* Quantite toujours affichee : « x1 » absent laissait
                          croire a un oubli plutot qu'a une unite. */}
                      <span className="inline-flex items-center rounded-md bg-foreground/[0.06] px-1.5 py-0.5 text-[11px] font-bold tabular-nums">
                        x{assignment.quantity}
                      </span>
                      {itemValue > 0 && (
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {fmtPrice(itemValue)}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Text CTA — clearer than an icon */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/50"
                    onClick={() =>
                      handleUnassign(
                        assignment.id,
                        product.id,
                        product.name,
                        returnQty[assignment.id] ?? assignment.quantity
                      )
                    }
                    disabled={unassignMutation.isPending}
                  >
                    Retirer
                  </Button>
                </div>

                {/* Quantite a rendre — uniquement s'il en detient plusieurs.
                    « Retirer » ne reprenait qu'une unite sur les 3 detenues,
                    sans le dire : il fallait cliquer trois fois. */}
                {assignment.quantity > 1 && (
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-[11px] text-muted-foreground">Rendre</span>
                    <div className="flex items-center rounded-md border bg-background h-7">
                      <button
                        type="button"
                        disabled={(returnQty[assignment.id] ?? assignment.quantity) <= 1}
                        onClick={() =>
                          setReturnQty((prev) => ({
                            ...prev,
                            [assignment.id]: Math.max(
                              1,
                              (prev[assignment.id] ?? assignment.quantity) - 1
                            ),
                          }))
                        }
                        className="px-2 h-full text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                        aria-label="Diminuer la quantité à rendre"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="w-7 text-center text-xs font-semibold tabular-nums">
                        {returnQty[assignment.id] ?? assignment.quantity}
                      </span>
                      <button
                        type="button"
                        disabled={
                          (returnQty[assignment.id] ?? assignment.quantity) >= assignment.quantity
                        }
                        onClick={() =>
                          setReturnQty((prev) => ({
                            ...prev,
                            [assignment.id]: Math.min(
                              assignment.quantity,
                              (prev[assignment.id] ?? assignment.quantity) + 1
                            ),
                          }))
                        }
                        className="px-2 h-full text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                        aria-label="Augmenter la quantité à rendre"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      sur {assignment.quantity}
                    </span>
                  </div>
                )}

                {/* Depuis quand il l'a — l'information manquait completement,
                    alors qu'elle figure deja sur la page Outillage. */}
                <p className="mt-3 border-t pt-2.5 text-[11px] text-muted-foreground tabular-nums">
                  Assigné le {fmtAssignedAt(assignment.assigned_at)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
