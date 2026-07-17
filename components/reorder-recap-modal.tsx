"use client";

import { useMemo, useState } from "react";
import { ClipboardCopy, Check, ShoppingCart, ChevronDown, Minus, Plus, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProductWithRelations } from "@/lib/supabase/queries/products";
import { STOCK_DEFAULTS } from "@/lib/utils/stock";
import { cn } from "@/lib/utils";

type ReorderFilter = "critique" | "all";

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

function computeReorderList(
  products: ProductWithRelations[],
  filter: ReorderFilter
): ReorderItem[] {
  return products
    .map((p) => {
      const current = p.stock_current ?? 0;
      const min = p.stock_min ?? STOCK_DEFAULTS.MIN;
      const target = min * 2;
      const toOrder = Math.max(0, target - current);
      const isCritique = current < min;
      return { product: p, toOrder, isCritique };
    })
    .filter((item) => {
      if (item.toOrder <= 0) return false;
      const current = item.product.stock_current ?? 0;
      const min = item.product.stock_min ?? STOCK_DEFAULTS.MIN;
      // Include critique (< min) and attention (<= min * 1.25)
      if (current > Math.ceil(min * 1.25)) return false;
      if (filter === "critique") return current < min;
      return true;
    })
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
  const totalUnits = group.items.reduce(
    (s, i) => s + (overrides.get(i.product.id) ?? i.toOrder),
    0
  );
  const totalValue = group.items.reduce(
    (s, i) => s + (overrides.get(i.product.id) ?? i.toOrder) * (i.product.price ?? 0),
    0
  );

  const lines = [
    `Bonjour,`,
    ``,
    `Nous souhaiterions passer commande pour les produits suivants :`,
    ``,
    ...group.items.map((item) => {
      const qty = overrides.get(item.product.id) ?? item.toOrder;
      return `- ${item.product.name} : ${qty} unite${qty > 1 ? "s" : ""}`;
    }),
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
  const [copied, setCopied] = useState(false);

  const adjustedTotal = group.items.reduce(
    (s, i) => s + (overrides.get(i.product.id) ?? i.toOrder) * (i.product.price ?? 0),
    0
  );
  const adjustedUnits = group.items.reduce(
    (s, i) => s + (overrides.get(i.product.id) ?? i.toOrder),
    0
  );

  const supplierEmail = group.items[0]?.product.supplier?.email ?? null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generateOrderBody(group, overrides));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              collapsed && "-rotate-90"
            )}
          />
          <span className="font-semibold text-sm">{group.supplierName}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {group.items.length} produit{group.items.length > 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground tabular-nums font-heading">
            {adjustedUnits} u.
          </span>
          {adjustedTotal > 0 && (
            <span className="text-xs font-semibold tabular-nums font-heading">
              {formatPrice(adjustedTotal)} &euro;
            </span>
          )}
        </div>
      </button>

      {!collapsed && (
        <div className="border-t divide-y">
          {group.items.map((item) => {
            const qty = overrides.get(item.product.id) ?? item.toOrder;
            const price = item.product.price ?? 0;
            const current = item.product.stock_current ?? 0;
            const min = item.product.stock_min ?? STOCK_DEFAULTS.MIN;
            return (
              <div key={item.product.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.product.name}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    <span
                      className={cn(
                        "font-semibold",
                        current === 0
                          ? "text-critique"
                          : current <= min
                            ? "text-attention"
                            : "text-foreground"
                      )}
                    >
                      {current}
                    </span>
                    {" / "}
                    {min} min
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOverride(item.product.id, Math.max(1, qty - 1))}
                    className="flex size-7 items-center justify-center rounded-md border bg-white dark:bg-card hover:bg-muted transition-colors cursor-pointer"
                  >
                    <Minus className="size-3" />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold tabular-nums font-heading">
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOverride(item.product.id, qty + 1)}
                    className="flex size-7 items-center justify-center rounded-md border bg-white dark:bg-card hover:bg-muted transition-colors cursor-pointer"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>

                {price > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums w-16 text-right shrink-0">
                    {formatPrice(qty * price)} &euro;
                  </span>
                )}
              </div>
            );
          })}

          <div className="px-4 py-2.5 flex gap-2">
            {supplierEmail ? (
              <>
                <Button variant="outline" size="sm" className="h-7 text-xs flex-1" asChild>
                  <a href={generateMailtoUrl(group, overrides)}>
                    <Mail className="size-3" />
                    Envoyer par mail
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={handleCopy}
                  title="Copier la liste"
                >
                  {copied ? <Check className="size-3" /> : <ClipboardCopy className="size-3" />}
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs w-full"
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <Check className="size-3" />
                    Copie !
                  </>
                ) : (
                  <>
                    <ClipboardCopy className="size-3" />
                    Copier la liste
                  </>
                )}
              </Button>
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
  const [filter, setFilter] = useState<ReorderFilter>("all");
  const [overrides, setOverrides] = useState<Map<string, number>>(new Map());

  const reorderList = useMemo(() => computeReorderList(products, filter), [products, filter]);
  const supplierGroups = useMemo(() => groupBySupplier(reorderList), [reorderList]);

  // Counts for the toggle
  const critiqueCount = useMemo(
    () =>
      products.filter((p) => {
        const current = p.stock_current ?? 0;
        const min = p.stock_min ?? STOCK_DEFAULTS.MIN;
        return current < min;
      }).length,
    [products]
  );
  const allCount = useMemo(
    () =>
      products.filter((p) => {
        const current = p.stock_current ?? 0;
        const min = p.stock_min ?? STOCK_DEFAULTS.MIN;
        return current <= Math.ceil(min * 1.25);
      }).length,
    [products]
  );

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
        <DialogHeader className="px-5 pt-5 pb-4 shrink-0 space-y-3">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <ShoppingCart className="size-4" />
            Produits a commander
          </DialogTitle>

          {/* Filter toggle */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground mr-1">A partir de</span>
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium transition-all cursor-pointer select-none",
                filter === "all"
                  ? "bg-attention/15 text-attention"
                  : "bg-foreground/[0.06] text-muted-foreground hover:text-foreground"
              )}
            >
              Attention
              <span className="tabular-nums font-heading">{allCount}</span>
            </button>
            <button
              type="button"
              onClick={() => setFilter("critique")}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium transition-all cursor-pointer select-none",
                filter === "critique"
                  ? "bg-critique/15 text-critique"
                  : "bg-foreground/[0.06] text-muted-foreground hover:text-foreground"
              )}
            >
              Critique
              <span className="tabular-nums font-heading">{critiqueCount}</span>
            </button>
          </div>
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
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun produit dans cette categorie.
            </p>
          )}
        </div>

        {/* Sticky footer */}
        {grandTotalUnits > 0 && (
          <div className="border-t px-5 py-3 shrink-0 flex items-center justify-between bg-muted/30">
            <span className="text-sm text-muted-foreground">Total</span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold tabular-nums font-heading">
                {grandTotalUnits} unites
              </span>
              {grandTotalValue > 0 && (
                <span className="text-sm font-semibold tabular-nums font-heading">
                  {formatPrice(grandTotalValue)} &euro; HT
                </span>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Re-export for the badge count in product list
export { computeReorderList };
