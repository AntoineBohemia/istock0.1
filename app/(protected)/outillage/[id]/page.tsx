"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, UserPlus, UserMinus, Wrench, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

import { useEquipmentProduct } from "@/hooks/queries";
import { useUnassignEquipment } from "@/hooks/mutations";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import ProductIconDisplay from "@/components/product-icon-display";
import { cn } from "@/lib/utils";
import AssignEquipmentModal from "../assign-equipment-modal";

// ── Helpers ──
function daysSinceAssignment(assignedAt: string): number {
  return Math.floor((Date.now() - new Date(assignedAt).getTime()) / 86_400_000);
}

function ageTier(days: number): "recent" | "normal" | "old" {
  if (days < 90) return "recent";
  if (days < 180) return "normal";
  return "old";
}

function ageDotClass(tier: "recent" | "normal" | "old"): string {
  switch (tier) {
    case "recent":
      return "bg-standard";
    case "normal":
      return "bg-foreground/20";
    case "old":
      return "bg-attention";
  }
}

function formatDuration(days: number): string {
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "1 jour";
  if (days < 30) return `${days} jours`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mois`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} an${years > 1 ? "s" : ""}`;
  return `${years}a ${rem}m`;
}

const fmtPrice = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { currentOrganization } = useOrganizationStore();
  const { data: product, isLoading } = useEquipmentProduct(id);
  const unassignMutation = useUnassignEquipment();
  const [assignOpen, setAssignOpen] = useState(false);

  const handleUnassign = (technicianId: string, techName: string) => {
    if (!currentOrganization?.id) return;

    unassignMutation.mutate(
      {
        organizationId: currentOrganization.id,
        productId: id,
        technicianId,
        quantity: 1,
      },
      {
        onSuccess: () => toast.success(`Outil récupéré de ${techName}`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur"),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6 pb-20">
        <div className="rounded-xl border bg-card p-6 space-y-5">
          <div className="flex items-center gap-5">
            <Skeleton className="size-10 rounded-lg" />
            <Skeleton className="size-14 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
        <div className="rounded-xl border bg-card overflow-hidden">
          <Skeleton className="h-10 w-full" />
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted mb-3">
          <Wrench className="size-6 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">Outil non trouvé</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/outillage">Retour</Link>
        </Button>
      </div>
    );
  }

  const stockAvailable = product.stock_current ?? 0;
  const totalUnits = stockAvailable + product.total_assigned;
  const assignedPct = totalUnits > 0 ? Math.round((product.total_assigned / totalUnits) * 100) : 0;
  const totalValue = (product.price ?? 0) * totalUnits;

  return (
    <div className="space-y-6 pb-20">
      {/* ── Hero ── */}
      <div className="rounded-xl border bg-card p-6 space-y-5">
        <div className="flex items-center gap-5">
          <Button variant="ghost" size="icon" asChild className="shrink-0 -ml-2">
            <Link href="/outillage">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <ProductIconDisplay
            iconName={product.icon_name}
            iconColor={product.icon_color}
            imageUrl={product.image_url}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-3xl font-bold tracking-tight truncate">
              {product.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {product.sku}
              {product.category && <> &middot; {product.category.name}</>}
            </p>
          </div>
          <Button
            variant="outline-contrast"
            onClick={() => setAssignOpen(true)}
            disabled={stockAvailable === 0}
          >
            <UserPlus className="size-4" />
            Assigner
          </Button>
        </div>

        {/* Stats + distribution bar */}
        <div className="border-t pt-5 space-y-4">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="font-heading text-5xl font-bold tabular-nums leading-none">
              {stockAvailable}
            </span>
            <span className="text-muted-foreground text-lg">
              disponible{stockAvailable > 1 ? "s" : ""}
            </span>
            <span className="text-muted-foreground text-lg mx-1.5">&middot;</span>
            <span className="font-heading text-xl font-bold tabular-nums">
              {product.total_assigned}
            </span>
            <span className="text-muted-foreground text-lg">
              assigné{product.total_assigned > 1 ? "s" : ""}
            </span>
            {totalValue > 0 && (
              <>
                <span className="text-muted-foreground text-lg mx-1.5">&middot;</span>
                <span className="text-muted-foreground text-lg tabular-nums">
                  {fmtPrice(totalValue)}
                </span>
              </>
            )}
          </div>

          {/* Distribution bar */}
          {totalUnits > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Répartition</span>
                <span className="tabular-nums">{assignedPct}% assigné</span>
              </div>
              <div className="h-2 rounded-full bg-foreground/[0.06] overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    assignedPct === 100 ? "bg-attention" : "bg-foreground/25"
                  )}
                  style={{ width: `${assignedPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Assignments ── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/50">
            Équipé par
          </h2>
          {product.assignments.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {product.assignments.length} technicien
              {product.assignments.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {product.assignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted mb-3">
              <Wrench className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Cet outil n'est assigné à aucun technicien
            </p>
            <Button
              size="sm"
              className="mt-4"
              onClick={() => setAssignOpen(true)}
              disabled={stockAvailable === 0}
            >
              <UserPlus className="size-3.5" />
              Assigner
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {product.assignments.map((a) => {
              const tech = a.technician;
              if (!tech) return null;
              const initials =
                `${tech.first_name.charAt(0)}${tech.last_name.charAt(0)}`.toUpperCase();
              const fullName = `${tech.first_name} ${tech.last_name}`;
              const days = daysSinceAssignment(a.assigned_at);
              const tier = ageTier(days);
              return (
                <div key={a.id} className="flex items-center gap-4 px-5 py-3.5">
                  <Avatar className="size-9">
                    {tech.photo_url && <AvatarImage src={tech.photo_url} />}
                    <AvatarFallback className="text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/techniciens/${tech.id}`}
                      className="text-[15px] font-semibold hover:underline"
                    >
                      {fullName}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      {a.quantity > 1 && (
                        <span className="text-xs font-bold tabular-nums">
                          x{a.quantity}
                        </span>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span
                          className={cn("size-1.5 rounded-full", ageDotClass(tier))}
                        />
                        <Clock className="size-2.5" />
                        <span className="tabular-nums">{formatDuration(days)}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => handleUnassign(tech.id, fullName)}
                    disabled={unassignMutation.isPending}
                  >
                    <UserMinus className="size-3.5" />
                    Récupérer
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AssignEquipmentModal
        productId={id}
        open={assignOpen}
        onOpenChange={setAssignOpen}
      />
    </div>
  );
}
