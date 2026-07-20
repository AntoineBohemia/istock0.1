"use client";

import { useMemo, useState } from "react";
import { ShoppingCart, ChevronDown, Minus, Plus, Mail, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProductWithRelations } from "@/lib/supabase/queries/products";
import { STOCK_DEFAULTS } from "@/lib/utils/stock";
import ProductIconDisplay from "@/components/product-icon-display";
import { cn } from "@/lib/utils";

interface ReorderItem {
  product: ProductWithRelations;
  toOrder: number;
  isCritique: boolean;
}

interface SupplierGroup {
  supplierId: string | null;
  supplierName: string;
  items: ReorderItem[];
  totalUnits: number;
  totalValue: number;
}

// A product is proposed for reorder only once it falls below its critical threshold.
// No suggested quantity: the user types what they actually want to order (starts at 0).
function computeReorderList(products: ProductWithRelations[]): ReorderItem[] {
  return products
    .filter((p) => (p.stock_current ?? 0) < (p.stock_min ?? STOCK_DEFAULTS.MIN))
    .map((p) => ({ product: p, toOrder: 0, isCritique: true }))
    .sort((a, b) => {
      const aRatio = (a.product.stock_current ?? 0) / (a.product.stock_min ?? STOCK_DEFAULTS.MIN);
      const bRatio = (b.product.stock_current ?? 0) / (b.product.stock_min ?? STOCK_DEFAULTS.MIN);
      return aRatio - bRatio;
    });
}

function groupBySupplier(items: ReorderItem[]): SupplierGroup[] {
  const groups = new Map<string | null, ReorderItem[]>();

  for (const item of items) {
    const key = item.product.supplier_id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const result: SupplierGroup[] = [];
  for (const [supplierId, groupItems] of groups) {
    const supplierName = groupItems[0]?.product.supplier?.name ?? "Sans fournisseur";
    result.push({
      supplierId,
      supplierName,
      items: groupItems,
      totalUnits: groupItems.reduce((s, i) => s + i.toOrder, 0),
      totalValue: groupItems.reduce((s, i) => s + i.toOrder * (i.product.price ?? 0), 0),
    });
  }

  return result.sort((a, b) => {
    if (a.supplierId === null) return 1;
    if (b.supplierId === null) return -1;
    return a.supplierName.localeCompare(b.supplierName);
  });
}

function formatPrice(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2 });
}

function generateOrderBody(group: SupplierGroup, overrides: Map<string, number>) {
  // Only lines the user actually filled in
  const ordered = group.items
    .map((item) => ({ item, qty: overrides.get(item.product.id) ?? item.toOrder }))
    .filter(({ qty }) => qty > 0);

  const totalUnits = ordered.reduce((s, { qty }) => s + qty, 0);
  const totalValue = ordered.reduce((s, { item, qty }) => s + qty * (item.product.price ?? 0), 0);

  const lines = [
    `Bonjour,`,
    ``,
    `Nous souhaiterions passer commande pour les produits suivants :`,
    ``,
    ...ordered.map(({ item, qty }) => `- ${item.product.name} : ${qty} unite${qty > 1 ? "s" : ""}`),
    ``,
    `Soit ${totalUnits} unites au total${totalValue > 0 ? ` (estimation ${formatPrice(totalValue)} EUR HT)` : ""}.`,
    ``,
    `Merci de nous confirmer la disponibilite et les delais de livraison.`,
    ``,
    `Cordialement`,
  ];

  return lines.join("\n");
}

function generateMailtoUrl(group: SupplierGroup, overrides: Map<string, number>) {
  const email = group.items[0]?.product.supplier?.email ?? "";
  const subject = `Commande - ${group.supplierName}`;
  const body = generateOrderBody(group, overrides);
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ─── Supplier section ──────────────────────────────────────
function SupplierSection({
  group,
  overrides,
  onOverride,
}: {
  group: SupplierGroup;
  overrides: Map<string, number>;
  onOverride: (productId: string, qty: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const adjustedTotal = group.items.reduce(
    (s, i) => s + (overrides.get(i.product.id) ?? i.toOrder) * (i.product.price ?? 0),
    0
  );
  const adjustedUnits = group.items.reduce(
    (s, i) => s + (overrides.get(i.product.id) ?? i.toOrder),
    0
  );

  const supplierEmail = group.items[0]?.product.supplier?.email ?? null;
  const supplierPhone = group.items[0]?.product.supplier?.phone ?? null;
  // Nothing to send until at least one quantity has been entered
  const hasQuantities = adjustedUnits > 0;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-start justify-between gap-3 w-full px-4 py-3 text-left hover:bg-muted/40 transition-colors cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <ChevronDown
            className={cn(
              "size-4 mt-0.5 shrink-0 text-muted-foreground transition-transform duration-200",
              collapsed && "-rotate-90"
            )}
          />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-sm truncate">{group.supplierName}</span>
              <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                {group.items.length} produit{group.items.length > 1 ? "s" : ""}
              </span>
            </div>
            {/* Contact — consultable sans ouvrir le groupe */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
              {supplierPhone && (
                <span className="flex items-center gap-1 tabular-nums">
                  <Phone className="size-3 shrink-0" />
                  {supplierPhone}
                </span>
              )}
              {supplierEmail && (
                <span className="flex items-center gap-1 min-w-0">
                  <Mail className="size-3 shrink-0" />
                  <span className="truncate">{supplierEmail}</span>
                </span>
              )}
              {!supplierPhone && !supplierEmail && (
                <span className="text-attention">Aucun contact renseigné</span>
              )}
            </div>
          </div>
        </div>
        {hasQuantities && (
          <div className="text-right shrink-0">
            <div className="font-heading font-bold text-sm tabular-nums leading-none">
              {adjustedUnits} u.
            </div>
            {adjustedTotal > 0 && (
              <div className="text-[11px] text-muted-foreground tabular-nums mt-1">
                {formatPrice(adjustedTotal)} &euro;
              </div>
            )}
          </div>
        )}
      </button>

      {!collapsed && (
        <div className="border-t divide-y">
          {group.items.map((item) => {
            const qty = overrides.get(item.product.id) ?? item.toOrder;
            const price = item.product.price ?? 0;
            const current = item.product.stock_current ?? 0;
            const min = item.product.stock_min ?? STOCK_DEFAULTS.MIN;
            return (
              <div
                key={item.product.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 transition-colors",
                  qty > 0 && "bg-primary/[0.04]"
                )}
              >
                <ProductIconDisplay
                  iconName={item.product.icon_name}
                  iconColor={item.product.icon_color}
                  imageUrl={item.product.image_url}
                  size="sm"
                  className="shrink-0"
                />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.product.name}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                    <span className="font-semibold text-critique">{current}</span> en stock · seuil{" "}
                    {min}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOverride(item.product.id, Math.max(0, qty - 1))}
                    disabled={qty === 0}
                    aria-label={`Retirer une unité de ${item.product.name}`}
                    className="flex size-8 items-center justify-center rounded-lg border bg-background hover:bg-muted active:scale-95 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span
                    className={cn(
                      "w-9 text-center text-sm font-bold tabular-nums font-heading transition-colors",
                      qty === 0 ? "text-muted-foreground/40" : "text-foreground"
                    )}
                  >
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOverride(item.product.id, qty + 1)}
                    aria-label={`Ajouter une unité de ${item.product.name}`}
                    className="flex size-8 items-center justify-center rounded-lg border bg-background hover:bg-muted active:scale-95 transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>

                {/* Le montant n'apparaît qu'une fois une quantité saisie */}
                <span className="w-16 text-right shrink-0 text-xs tabular-nums">
                  {qty > 0 && price > 0 ? (
                    <span className="font-semibold">{formatPrice(qty * price)} &euro;</span>
                  ) : (
                    <span className="text-muted-foreground/30">&mdash;</span>
                  )}
                </span>
              </div>
            );
          })}

          <div className="px-4 py-2.5 space-y-1.5">
            <div className="flex gap-2">
              {supplierEmail && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs flex-1"
                  disabled={!hasQuantities}
                  onClick={() => {
                    window.location.href = generateMailtoUrl(group, overrides);
                  }}
                >
                  <Mail className="size-3" />
                  Commander par mail
                </Button>
              )}
              {supplierPhone && (
                <Button variant="outline" size="sm" className="h-8 text-xs flex-1" asChild>
                  <a href={`tel:${supplierPhone.replace(/\s/g, "")}`}>
                    <Phone className="size-3" />
                    Appeler
                  </a>
                </Button>
              )}
            </div>
            {!hasQuantities && (
              <p className="text-[11px] text-muted-foreground text-center">
                Saisissez au moins une quantité pour commander.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main modal ────────────────────────────────────────────
interface ReorderRecapModalProps {
  open: boolean;
  onClose: () => void;
  products: ProductWithRelations[];
}

export default function ReorderRecapModal({ open, onClose, products }: ReorderRecapModalProps) {
  const [overrides, setOverrides] = useState<Map<string, number>>(new Map());

  const reorderList = useMemo(() => computeReorderList(products), [products]);
  const supplierGroups = useMemo(() => groupBySupplier(reorderList), [reorderList]);

  const handleOverride = (productId: string, qty: number) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(productId, qty);
      return next;
    });
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      onClose();
      setOverrides(new Map());
    }
  };

  const grandTotalUnits = reorderList.reduce(
    (s, i) => s + (overrides.get(i.product.id) ?? i.toOrder),
    0
  );
  const grandTotalValue = reorderList.reduce(
    (s, i) => s + (overrides.get(i.product.id) ?? i.toOrder) * (i.product.price ?? 0),
    0
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0 max-h-[85vh] flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-4 shrink-0 space-y-1.5">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <ShoppingCart className="size-4" />
            Produits à commander
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {reorderList.length > 0 ? (
              <>
                <span className="font-semibold text-critique tabular-nums">
                  {reorderList.length}
                </span>{" "}
                produit{reorderList.length > 1 ? "s" : ""} sous le seuil critique. Saisissez les
                quantités puis envoyez la commande au fournisseur.
              </>
            ) : (
              "Aucun produit sous le seuil critique."
            )}
          </p>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-3">
          {supplierGroups.length > 0 ? (
            supplierGroups.map((group) => (
              <SupplierSection
                key={group.supplierId ?? "__none"}
                group={group}
                overrides={overrides}
                onOverride={handleOverride}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted mb-3">
                <ShoppingCart className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold">Rien à commander</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                Aucun produit n&apos;est passé sous son seuil critique.
              </p>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        {grandTotalUnits > 0 && (
          <div className="border-t px-5 py-3 shrink-0 flex items-end justify-between bg-muted/30">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                Total commande
              </p>
              <p className="text-sm text-muted-foreground tabular-nums mt-0.5">
                {grandTotalUnits} unité{grandTotalUnits > 1 ? "s" : ""}
              </p>
            </div>
            {grandTotalValue > 0 && (
              <span className="font-heading text-xl font-bold tabular-nums leading-none">
                {formatPrice(grandTotalValue)} &euro;{" "}
                <span className="text-xs font-medium text-muted-foreground">HT</span>
              </span>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Re-export for the badge count in product list
export { computeReorderList };
