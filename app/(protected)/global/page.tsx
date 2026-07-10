"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  Search,
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  X,
  Loader2,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { StatusPill } from "@/components/ui/status-pill";
import { HeroNumber } from "@/components/ui/hero-number";

import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useProducts, useTechnicians, useStockMovements } from "@/hooks/queries";
import { useCreateStockEntry, useCreateStockExit } from "@/hooks/mutations";
import { calculateStockScore, getStockBadgeVariant } from "@/lib/utils/stock";
import { cn } from "@/lib/utils";

const MOVEMENT_LABELS: Record<string, string> = {
  entry: "Entrée",
  exit_technician: "Sortie technicien",
  exit_anonymous: "Sortie autre",
};

type ActionMode = "entry" | "exit_technician" | "exit_anonymous";

interface ConsoleProduct {
  id: string;
  name: string;
  sku: string | null;
  stock_current: number;
  stock_min: number | null;
}

interface CartItem {
  product: ConsoleProduct;
  quantity: number;
}

interface SessionEntry {
  localId: string;
  movementType: ActionMode;
  productId: string;
  productName: string;
  quantity: number;
  stockAfter: number;
  technicianName?: string;
}

// ─── Composant principal ────────────────────────────────────
export default function GlobalPage() {
  const prefersReducedMotion = useReducedMotion();
  const orgId = useOrganizationStore((s) => s.currentOrganization?.id);

  // Mode
  const [actionMode, setActionMode] = useState<ActionMode>("entry");
  const [technicianId, setTechnicianId] = useState("");

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Single product (mode entrée / sortie autre)
  const [product, setProduct] = useState<ConsoleProduct | null>(null);

  // Multi-product cart (mode sortie technicien)
  const [cart, setCart] = useState<CartItem[]>([]);

  // Quantité (single product mode)
  const [quantity, setQuantity] = useState<number>(1);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  // Journal
  const [session, setSession] = useState<SessionEntry[]>([]);
  const [revertingIds, setRevertingIds] = useState<Set<string>>(new Set());
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);

  // ─── Data ──────────────────────────────────────────────
  const { data: productsResult, isLoading: isSearching } = useProducts({
    organizationId: orgId,
    search: searchQuery || undefined,
  });
  const { data: techniciansData = [] } = useTechnicians(orgId);
  const searchResults = productsResult?.products ?? [];

  const filteredTechnicians = useMemo(() => {
    if (!searchQuery.trim()) return techniciansData.slice(0, 5);
    const q = searchQuery.toLowerCase();
    return techniciansData
      .filter((t) => `${t.first_name} ${t.last_name}`.toLowerCase().includes(q))
      .slice(0, 5);
  }, [techniciansData, searchQuery]);

  // Mouvements du jour
  const [pageLoadTime] = useState(() => new Date().toISOString());
  const today = new Date().toISOString().split("T")[0];
  const { data: todayResult, isLoading: isLoadingToday } = useStockMovements({
    organizationId: orgId,
    startDate: today,
  });
  const olderMovements = (todayResult?.movements ?? []).filter(
    (m) => m.created_at && m.created_at < pageLoadTime
  );

  // Mutations
  const createEntry = useCreateStockEntry();
  const createExit = useCreateStockExit();
  const isSubmitting = createEntry.isPending || createExit.isPending || isBatchSubmitting;

  // Technicien sélectionné
  const selectedTech = useMemo(
    () => techniciansData.find((t) => t.id === technicianId),
    [techniciansData, technicianId]
  );
  const techFullName = selectedTech ? `${selectedTech.first_name} ${selectedTech.last_name}` : "";

  // Cart totals
  const cartTotalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-search-container]")) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [searchOpen]);

  // ─── Sélection produit ────────────────────────────────
  const selectProduct = useCallback(
    (p: ConsoleProduct) => {
      if (technicianId) {
        // Mode tech : ajouter au panier
        setCart((prev) => {
          const existing = prev.find((item) => item.product.id === p.id);
          if (existing) {
            return prev.map((item) =>
              item.product.id === p.id
                ? { ...item, quantity: Math.min(item.quantity + 1, item.product.stock_current) }
                : item
            );
          }
          return [...prev, { product: { ...p }, quantity: 1 }];
        });
        setSearchQuery("");
        // Garder la recherche focusée pour ajouter d'autres produits
        setTimeout(() => searchInputRef.current?.focus(), 60);
      } else {
        // Mode single : sélectionner le produit
        setProduct(p);
        setSearchQuery("");
        setSearchOpen(false);
        setQuantity(1);
        if (!technicianId) setActionMode("entry");
        setTimeout(() => quantityInputRef.current?.focus(), 60);
      }
    },
    [technicianId]
  );

  // ─── Sélection technicien ─────────────────────────────
  const selectTechnician = useCallback((techId: string) => {
    setTechnicianId(techId);
    setActionMode("exit_technician");
    setProduct(null);
    setCart([]);
    setSearchQuery("");
    setSearchOpen(false);
    setQuantity(1);
    setTimeout(() => searchInputRef.current?.focus(), 60);
  }, []);

  // ─── Retirer le technicien ────────────────────────────
  const clearTechnician = useCallback(() => {
    setTechnicianId("");
    setActionMode("entry");
    setProduct(null);
    setCart([]);
    setQuantity(1);
    setTimeout(() => searchInputRef.current?.focus(), 60);
  }, []);

  // ─── Cart actions ─────────────────────────────────────
  const updateCartQty = useCallback((productId: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const newQty = Math.max(1, Math.min(item.quantity + delta, item.product.stock_current));
        return { ...item, quantity: newQty };
      })
    );
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  // ─── Placeholder contextuel ───────────────────────────
  const searchPlaceholder = useMemo(() => {
    if (technicianId && techFullName) return `Ajouter un produit pour ${techFullName}…`;
    return "Rechercher un produit ou un technicien…";
  }, [technicianId, techFullName]);

  // ─── Label du bouton (single mode) ────────────────────
  const submitLabel = useMemo(() => {
    const u = quantity > 1 ? "unités" : "unité";
    if (actionMode === "entry") return `Entrer ${quantity} ${u}`;
    return `Sortir ${quantity} ${u}`;
  }, [actionMode, quantity]);

  // ─── Soumission single ────────────────────────────────
  const handleSubmit = useCallback(() => {
    if (!product || !orgId || isSubmitting) return;
    if (quantity < 1) return;

    const isEntry = actionMode === "entry";

    if (!isEntry && quantity > product.stock_current) {
      toast.error(`Stock insuffisant · disponible : ${product.stock_current}`);
      return;
    }

    const stockAfter = isEntry
      ? product.stock_current + quantity
      : product.stock_current - quantity;
    const localId = crypto.randomUUID();

    const onSuccess = () => {
      setProduct((prev) => (prev ? { ...prev, stock_current: stockAfter } : prev));
      setSession((prev) => [
        {
          localId,
          movementType: actionMode,
          productId: product.id,
          productName: product.name,
          quantity,
          stockAfter,
        },
        ...prev,
      ]);
      const sign = isEntry ? "+" : "−";
      toast.success(`${sign}${quantity} ${product.name} · ${stockAfter} en stock`);
      setQuantity(1);

      if (isEntry) {
        setTimeout(() => quantityInputRef.current?.focus(), 60);
      } else {
        setProduct(null);
        setTimeout(() => searchInputRef.current?.focus(), 60);
      }
    };

    const onError = (error: Error) => {
      toast.error(error.message ?? "Erreur lors de l'enregistrement");
    };

    if (isEntry) {
      createEntry.mutate(
        { organizationId: orgId, productId: product.id, quantity },
        { onSuccess, onError }
      );
    } else {
      createExit.mutate(
        { organizationId: orgId, productId: product.id, quantity, type: actionMode },
        { onSuccess, onError }
      );
    }
  }, [product, orgId, quantity, actionMode, isSubmitting, createEntry, createExit]);

  // ─── Soumission batch (mode technicien) ───────────────
  const handleBatchSubmit = useCallback(async () => {
    if (!orgId || !technicianId || cart.length === 0 || isBatchSubmitting) return;

    // Vérifier les stocks
    for (const item of cart) {
      if (item.quantity > item.product.stock_current) {
        toast.error(`Stock insuffisant pour ${item.product.name}`);
        return;
      }
    }

    setIsBatchSubmitting(true);

    let successCount = 0;
    for (const item of cart) {
      try {
        await createExit.mutateAsync({
          organizationId: orgId,
          productId: item.product.id,
          quantity: item.quantity,
          type: "exit_technician",
          technicianId,
        });
        const stockAfter = item.product.stock_current - item.quantity;
        setSession((prev) => [
          {
            localId: crypto.randomUUID(),
            movementType: "exit_technician",
            productId: item.product.id,
            productName: item.product.name,
            quantity: item.quantity,
            stockAfter,
            technicianName: techFullName,
          },
          ...prev,
        ]);
        successCount++;
      } catch {
        toast.error(`Erreur pour ${item.product.name}`);
      }
    }

    setIsBatchSubmitting(false);

    if (successCount > 0) {
      toast.success(
        `${successCount} produit${successCount > 1 ? "s" : ""} sorti${successCount > 1 ? "s" : ""} vers ${techFullName}`
      );
      setCart([]);
      setTimeout(() => searchInputRef.current?.focus(), 60);
    }
  }, [orgId, technicianId, cart, isBatchSubmitting, techFullName, createExit]);

  // ─── Annulation ───────────────────────────────────────
  const handleRevert = useCallback(
    (entry: SessionEntry) => {
      if (!orgId || revertingIds.has(entry.localId)) return;
      setRevertingIds((prev) => new Set([...prev, entry.localId]));

      const isEntryRevert = entry.movementType === "entry";
      const revertedStock = isEntryRevert
        ? entry.stockAfter - entry.quantity
        : entry.stockAfter + entry.quantity;

      const onSuccess = () => {
        setSession((prev) => prev.filter((e) => e.localId !== entry.localId));
        setRevertingIds((prev) => {
          const n = new Set(prev);
          n.delete(entry.localId);
          return n;
        });
        setProduct((prev) =>
          prev?.id === entry.productId ? { ...prev, stock_current: revertedStock } : prev
        );
        toast.success(
          `Annulé · ${isEntryRevert ? "−" : "+"}${entry.quantity} ${entry.productName}`
        );
      };
      const onError = () => {
        setRevertingIds((prev) => {
          const n = new Set(prev);
          n.delete(entry.localId);
          return n;
        });
        toast.error("Impossible d'annuler");
      };

      if (isEntryRevert) {
        createExit.mutate(
          {
            organizationId: orgId,
            productId: entry.productId,
            quantity: entry.quantity,
            type: "exit_anonymous",
            notes: "Annulation",
          },
          { onSuccess, onError }
        );
      } else {
        createEntry.mutate(
          {
            organizationId: orgId,
            productId: entry.productId,
            quantity: entry.quantity,
            notes: "Annulation",
          },
          { onSuccess, onError }
        );
      }
    },
    [orgId, revertingIds, createEntry, createExit]
  );

  // ─── Raccourcis clavier ────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        setSession((prev) => {
          const last = prev[0];
          if (last && !revertingIds.has(last.localId)) handleRevert(last);
          return prev;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [revertingIds, handleRevert]);

  // Statut produit actif
  const stockScore = product ? calculateStockScore(product.stock_current, product.stock_min) : 0;
  const stockStatus = product ? getStockBadgeVariant(stockScore) : "standard";

  const showTechsInSearch = !technicianId;

  // ════════════════════════════════════════════════════════
  return (
    <>
      {/* ═══════ MOBILE CONSOLE ═══════ */}
      <div className="md:hidden flex flex-col gap-3 pb-6">
        {/* Search bar mobile */}
        <div className="relative" data-search-container>
          {technicianId && techFullName && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
              <span className="max-w-[8rem] truncate">{techFullName}</span>
              <button onClick={clearTechnician}>
                <X className="size-3" />
              </button>
            </div>
          )}
          {!technicianId && (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none z-10" />
          )}
          <Input
            ref={searchInputRef}
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!searchOpen) setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearchOpen(false);
                searchInputRef.current?.blur();
              }
            }}
            className={cn(
              "h-12 text-base bg-white dark:bg-card rounded-xl",
              technicianId ? "" : "pl-10"
            )}
            style={
              technicianId ? { paddingLeft: `${techFullName.length * 0.55 + 3.5}rem` } : undefined
            }
          />
          {searchOpen && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border bg-popover text-popover-foreground shadow-lg overflow-hidden max-h-[60vh] overflow-y-auto">
              {isSearching && searchQuery ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Recherche…</div>
              ) : (
                <>
                  {showTechsInSearch && filteredTechnicians.length > 0 && (
                    <div>
                      <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Techniciens
                      </div>
                      {filteredTechnicians.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => selectTechnician(t.id)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors active:bg-accent"
                        >
                          <div className="flex items-center justify-center size-8 rounded-full bg-muted text-xs font-semibold shrink-0">
                            {t.first_name[0]}
                            {t.last_name[0]}
                          </div>
                          <span className="text-sm font-medium">
                            {t.first_name} {t.last_name}
                          </span>
                          <ArrowUpFromLine className="ml-auto size-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.length > 0 && (
                    <div>
                      <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {technicianId ? "Ajouter au panier" : "Produits"}
                      </div>
                      {searchResults.map((p) => {
                        const score = calculateStockScore(p.stock_current, p.stock_min);
                        const status = getStockBadgeVariant(score);
                        const inCart = cart.some((item) => item.product.id === p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() =>
                              selectProduct({
                                id: p.id,
                                name: p.name,
                                sku: p.sku,
                                stock_current: p.stock_current ?? 0,
                                stock_min: p.stock_min,
                              })
                            }
                            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors active:bg-accent"
                          >
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium">{p.name}</span>
                              {p.sku && (
                                <span className="ml-2 text-xs text-muted-foreground font-mono">
                                  {p.sku}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {inCart && (
                                <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                  ajouté
                                </span>
                              )}
                              <span className="tabular-nums text-sm text-muted-foreground">
                                {p.stock_current ?? 0}
                              </span>
                              <StatusPill status={status} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {searchResults.length === 0 &&
                    filteredTechnicians.length === 0 &&
                    searchQuery && (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        Aucun résultat.
                      </div>
                    )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Mode tech : panier mobile */}
        {technicianId && cart.length > 0 && (
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Sortie vers {techFullName}
              </p>
              <span className="text-xs text-muted-foreground tabular-nums font-heading">
                {cart.length} prod. · {cartTotalItems} items
              </span>
            </div>
            <ul className="space-y-2">
              {cart.map((item) => (
                <li key={item.product.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      dispo {item.product.stock_current}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateCartQty(item.product.id, -1)}
                      disabled={item.quantity <= 1}
                      className="size-8 rounded-lg border flex items-center justify-center active:bg-muted disabled:opacity-30"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-8 text-center font-heading font-bold tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateCartQty(item.product.id, 1)}
                      disabled={item.quantity >= item.product.stock_current}
                      className="size-8 rounded-lg border flex items-center justify-center active:bg-muted disabled:opacity-30"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="text-muted-foreground active:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <Button
              onClick={handleBatchSubmit}
              disabled={isSubmitting}
              variant="outline"
              className="w-full h-12 text-base"
            >
              {isBatchSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> En cours…
                </>
              ) : (
                <>
                  <ArrowUpFromLine className="size-4" /> Valider la sortie
                </>
              )}
            </Button>
          </div>
        )}

        {/* Mode single : produit sélectionné */}
        {!technicianId && product && (
          <div className="rounded-xl border bg-card p-4 space-y-4">
            {/* Produit info */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-heading text-lg font-semibold leading-tight truncate">
                  {product.name}
                </h2>
                {product.sku && (
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{product.sku}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setProduct(null);
                  setActionMode("entry");
                }}
                className="text-muted-foreground active:text-foreground shrink-0 mt-0.5"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Stock hero compact */}
            <div className="flex items-center gap-3">
              <span className="font-heading font-bold text-3xl tabular-nums">
                <HeroNumber value={product.stock_current} />
              </span>
              <StatusPill status={stockStatus} />
            </div>

            {/* Mode pills */}
            <div className="flex gap-1.5">
              {[
                { mode: "entry" as const, label: "Entrée", icon: ArrowDownToLine },
                { mode: "exit_anonymous" as const, label: "Sortie", icon: ArrowUpFromLine },
              ].map(({ mode, label, icon: ModeIcon }) => (
                <button
                  key={mode}
                  onClick={() => setActionMode(mode)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors",
                    actionMode === mode
                      ? mode === "entry"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                      : "bg-muted/40 text-muted-foreground active:bg-muted"
                  )}
                >
                  <ModeIcon className="size-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Quantity + submit */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="size-12 rounded-xl border flex items-center justify-center active:bg-muted shrink-0"
              >
                <Minus className="size-5" />
              </button>
              <Input
                ref={quantityInputRef}
                type="number"
                min={1}
                max={actionMode !== "entry" ? product.stock_current : undefined}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    navigator.vibrate?.(15);
                    handleSubmit();
                  }
                }}
                className="flex-1 h-12 text-xl font-heading font-bold tabular-nums text-center bg-white dark:bg-card rounded-xl"
              />
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="size-12 rounded-xl border flex items-center justify-center active:bg-muted shrink-0"
              >
                <Plus className="size-5" />
              </button>
            </div>

            <Button
              className="w-full h-12 text-base"
              onClick={() => {
                navigator.vibrate?.(15);
                handleSubmit();
              }}
              disabled={isSubmitting}
              variant={actionMode === "entry" ? "default" : "outline"}
            >
              {isSubmitting ? "En cours…" : submitLabel}
            </Button>
          </div>
        )}

        {/* Empty state mobile */}
        {!technicianId && !product && (
          <div className="rounded-xl border bg-card p-8 flex flex-col items-center justify-center gap-3 text-center">
            <Package className="size-12 text-muted-foreground opacity-20" />
            <p className="font-heading font-semibold">Recherchez un produit</p>
            <p className="text-sm text-muted-foreground">
              ou sélectionnez un technicien pour une sortie
            </p>
          </div>
        )}

        {/* Historique du jour mobile */}
        <div className="space-y-2">
          <h3 className="font-heading text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">
            Historique du jour
          </h3>
          {session.length === 0 && olderMovements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {isLoadingToday ? (
                <Loader2 className="size-4 animate-spin inline" />
              ) : (
                "Aucun mouvement aujourd'hui."
              )}
            </p>
          ) : (
            <ul className="space-y-1.5">
              <AnimatePresence initial={false}>
                {session.map((entry) => {
                  const isEntry = entry.movementType === "entry";
                  const reverting = revertingIds.has(entry.localId);
                  return (
                    <motion.li
                      key={entry.localId}
                      initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={prefersReducedMotion ? undefined : { opacity: 0, height: 0 }}
                      transition={{ type: "spring", bounce: 0.05, duration: 0.25 }}
                      className={cn(
                        "rounded-xl border-l-2 px-3 py-2.5",
                        isEntry
                          ? "border-l-standard bg-standard-bg/30"
                          : "border-l-critique bg-critique-bg/30"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "font-heading font-bold tabular-nums text-sm shrink-0",
                            isEntry ? "text-standard" : "text-critique"
                          )}
                        >
                          {isEntry ? "+" : "−"}
                          {entry.quantity}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate">{entry.productName}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {MOVEMENT_LABELS[entry.movementType]}
                            {entry.technicianName && ` → ${entry.technicianName}`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRevert(entry)}
                          disabled={reverting}
                          className="text-[11px] text-muted-foreground active:text-foreground shrink-0 disabled:opacity-30"
                        >
                          {reverting ? "…" : "annuler"}
                        </button>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
              {olderMovements.map((m) => {
                const isEntry = m.movement_type === "entry";
                const time = m.created_at
                  ? new Date(m.created_at).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "";
                const techName = m.technician
                  ? `${m.technician.first_name} ${m.technician.last_name}`
                  : undefined;
                return (
                  <li
                    key={m.id}
                    className={cn(
                      "rounded-xl border-l-2 px-3 py-2.5",
                      isEntry
                        ? "border-l-standard/50 bg-standard-bg/20"
                        : "border-l-critique/50 bg-critique-bg/20"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "font-heading font-bold tabular-nums text-sm shrink-0",
                          isEntry ? "text-standard" : "text-critique"
                        )}
                      >
                        {isEntry ? "+" : "−"}
                        {m.quantity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate">{m.product?.name ?? "—"}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {MOVEMENT_LABELS[m.movement_type] ?? m.movement_type}
                          {techName && ` → ${techName}`}
                        </p>
                      </div>
                      {time && (
                        <span className="text-[10px] font-heading tabular-nums text-muted-foreground shrink-0">
                          {time}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="hidden md:flex flex-col gap-4" style={{ height: "calc(100vh - 6rem)" }}>
        {/* ── Search bar ── */}
        <div className="relative" data-search-container>
          {technicianId && techFullName && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
              <span>{techFullName}</span>
              <button
                onClick={clearTechnician}
                className="hover:text-primary/70 transition-colors"
                aria-label="Retirer le technicien"
              >
                <X className="size-3" />
              </button>
            </div>
          )}
          {!technicianId && (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none z-10" />
          )}
          <Input
            ref={searchInputRef}
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!searchOpen) setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearchOpen(false);
                searchInputRef.current?.blur();
              }
            }}
            className={cn("h-11 text-base bg-white dark:bg-card", technicianId ? "" : "pl-9")}
            style={
              technicianId ? { paddingLeft: `${techFullName.length * 0.55 + 3.5}rem` } : undefined
            }
            autoFocus
          />

          {searchOpen && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover text-popover-foreground shadow-md overflow-hidden">
              {isSearching && searchQuery ? (
                <div className="py-6 text-center text-sm text-muted-foreground">Recherche…</div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  {showTechsInSearch && filteredTechnicians.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Sortie vers technicien
                      </div>
                      {filteredTechnicians.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => selectTechnician(t.id)}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                        >
                          <div className="flex items-center justify-center size-7 rounded-full bg-muted text-[11px] font-medium shrink-0">
                            {t.first_name[0]}
                            {t.last_name[0]}
                          </div>
                          <span>
                            {t.first_name} {t.last_name}
                          </span>
                          <ArrowUpFromLine className="ml-auto size-3.5 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {technicianId ? "Ajouter au panier" : "Produits"}
                      </div>
                      {searchResults.map((p) => {
                        const score = calculateStockScore(p.stock_current, p.stock_min);
                        const status = getStockBadgeVariant(score);
                        const inCart = cart.some((item) => item.product.id === p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() =>
                              selectProduct({
                                id: p.id,
                                name: p.name,
                                sku: p.sku,
                                stock_current: p.stock_current ?? 0,
                                stock_min: p.stock_min,
                              })
                            }
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-accent transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <span className="font-medium">{p.name}</span>
                              {p.sku && (
                                <span className="ml-2 text-xs text-muted-foreground font-mono">
                                  {p.sku}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {inCart && (
                                <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                  dans le panier
                                </span>
                              )}
                              <span className="tabular-nums text-sm text-muted-foreground">
                                {p.stock_current ?? 0}
                              </span>
                              <StatusPill status={status} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {searchResults.length === 0 &&
                    filteredTechnicians.length === 0 &&
                    searchQuery && (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        Aucun résultat.
                      </div>
                    )}
                  {!searchQuery &&
                    searchResults.length === 0 &&
                    filteredTechnicians.length === 0 && (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        Commencez à taper pour rechercher.
                      </div>
                    )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Layout deux colonnes ── */}
        <div className="grid grid-cols-[1fr_300px] gap-4 flex-1 min-h-0">
          {/* ── Panneau principal ── */}
          <div className="rounded-lg border bg-card p-6 flex flex-col gap-5 overflow-y-auto">
            {/* ═══ MODE TECHNICIEN : panier multi-produits ═══ */}
            {technicianId ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      Sortie vers technicien
                    </p>
                    <h2 className="font-heading text-xl font-semibold">{techFullName}</h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearTechnician}
                    className="text-muted-foreground"
                  >
                    <X className="size-4" />
                    Annuler
                  </Button>
                </div>

                {cart.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-12">
                    <Package className="size-14 text-muted-foreground opacity-20" />
                    <p className="text-sm text-muted-foreground">
                      Recherchez des produits ci-dessus pour les ajouter au panier
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="h-px bg-border" />
                    <ul className="space-y-2">
                      {cart.map((item) => (
                        <li
                          key={item.product.id}
                          className="flex items-center gap-3 rounded-lg border p-3"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.product.name}</p>
                            {item.product.sku && (
                              <p className="text-xs text-muted-foreground font-mono">
                                {item.product.sku}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Dispo : {item.product.stock_current}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-7"
                              onClick={() => updateCartQty(item.product.id, -1)}
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="size-3" />
                            </Button>
                            <span className="w-8 text-center font-heading font-semibold tabular-nums text-sm">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-7"
                              onClick={() => updateCartQty(item.product.id, 1)}
                              disabled={item.quantity >= item.product.stock_current}
                            >
                              <Plus className="size-3" />
                            </Button>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </li>
                      ))}
                    </ul>

                    <div className="h-px bg-border" />

                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-heading tabular-nums font-medium text-foreground">
                          {cart.length}
                        </span>{" "}
                        produit{cart.length > 1 ? "s" : ""} ·{" "}
                        <span className="font-heading tabular-nums font-medium text-foreground">
                          {cartTotalItems}
                        </span>{" "}
                        item{cartTotalItems > 1 ? "s" : ""}
                      </p>
                      <Button
                        onClick={handleBatchSubmit}
                        disabled={isSubmitting}
                        variant="outline"
                        className="h-10"
                      >
                        {isBatchSubmitting ? (
                          <>
                            <Loader2 className="size-4 animate-spin" /> En cours…
                          </>
                        ) : (
                          <>
                            <ArrowUpFromLine className="size-4" /> Valider la sortie
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </>
            ) : product ? (
              /* ═══ MODE SINGLE PRODUIT (entrée / sortie autre) ═══ */
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      {actionMode === "entry" ? "Entrée de stock" : "Sortie autre"}
                    </p>
                    <h2 className="font-heading text-xl font-semibold leading-tight">
                      {product.name}
                    </h2>
                    {product.sku && (
                      <p className="text-sm text-muted-foreground font-mono mt-0.5">
                        {product.sku}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setProduct(null);
                      setActionMode("entry");
                      setTimeout(() => searchInputRef.current?.focus(), 60);
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors mt-1 shrink-0"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="flex items-end gap-4">
                  <span className="font-heading font-bold text-5xl leading-none tabular-nums">
                    <HeroNumber value={product.stock_current} />
                  </span>
                  <div className="mb-1 space-y-1">
                    <StatusPill status={stockStatus} />
                    {product.stock_min != null && (
                      <p className="text-xs text-muted-foreground">
                        seuil critique : {product.stock_min}
                      </p>
                    )}
                  </div>
                </div>

                <div className="h-px bg-border" />

                <div className="flex gap-2 items-center">
                  <Input
                    ref={quantityInputRef}
                    type="number"
                    min={1}
                    max={actionMode !== "entry" ? product.stock_current : undefined}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        navigator.vibrate?.(15);
                        handleSubmit();
                      }
                    }}
                    className="w-24 tabular-nums text-lg font-heading text-center bg-white dark:bg-card"
                  />
                  <Button
                    className={cn("h-10", actionMode === "entry" ? "flex-1" : "")}
                    onClick={() => {
                      navigator.vibrate?.(15);
                      handleSubmit();
                    }}
                    disabled={isSubmitting}
                    variant={actionMode === "entry" ? "default" : "outline"}
                  >
                    {isSubmitting ? "En cours…" : submitLabel}
                  </Button>
                  {actionMode === "entry" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-10 text-xs"
                      onClick={() => setActionMode("exit_anonymous")}
                    >
                      <ArrowUpFromLine className="size-3.5" />
                      Sortie autre
                    </Button>
                  )}
                  {actionMode === "exit_anonymous" && (
                    <Button
                      variant="default"
                      size="sm"
                      className="h-10 text-xs"
                      onClick={() => setActionMode("entry")}
                    >
                      <ArrowDownToLine className="size-3.5" />
                      Entrer
                    </Button>
                  )}
                </div>
                <div className="flex-1" />
              </>
            ) : (
              /* ═══ ÉTAT VIDE ═══ */
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-12">
                <Package className="size-14 text-muted-foreground opacity-20" />
                <p className="font-heading font-semibold text-foreground">
                  Aucun produit sélectionné
                </p>
                <p className="text-sm text-muted-foreground">
                  Recherchez un produit ou un technicien ci-dessus
                </p>
              </div>
            )}
          </div>

          {/* ── Historique du jour ── */}
          <div className="rounded-lg border bg-card p-4 flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between shrink-0">
              <h3 className="font-heading text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Historique du jour
              </h3>
              {(session.length > 0 || olderMovements.length > 0) && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {session.length + olderMovements.length} mouv.
                </span>
              )}
            </div>

            {session.length === 0 && olderMovements.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                {isLoadingToday ? (
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                ) : (
                  <p className="text-sm text-muted-foreground text-center">
                    Aucun mouvement
                    <br />
                    aujourd&apos;hui.
                  </p>
                )}
              </div>
            ) : (
              <ul className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
                <AnimatePresence initial={false}>
                  {session.map((entry) => {
                    const isEntry = entry.movementType === "entry";
                    const reverting = revertingIds.has(entry.localId);
                    return (
                      <motion.li
                        key={entry.localId}
                        initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={
                          prefersReducedMotion
                            ? undefined
                            : { opacity: 0, height: 0, marginBottom: 0, overflow: "hidden" }
                        }
                        transition={{ type: "spring", bounce: 0.05, duration: 0.25 }}
                        className={cn(
                          "group rounded-lg border-l-2 px-3 py-2.5 transition-colors hover:bg-muted/30",
                          isEntry
                            ? "border-l-standard bg-standard-bg/30"
                            : "border-l-critique bg-critique-bg/30"
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          <span
                            className={cn(
                              "font-heading font-bold tabular-nums text-sm mt-0.5 shrink-0",
                              isEntry ? "text-standard" : "text-critique"
                            )}
                          >
                            {isEntry ? "+" : "−"}
                            {entry.quantity}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium truncate leading-tight">
                              {entry.productName}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {MOVEMENT_LABELS[entry.movementType]}
                              {entry.technicianName && ` → ${entry.technicianName}`}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRevert(entry)}
                            disabled={reverting}
                            className="text-[11px] text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5 disabled:opacity-30"
                          >
                            {reverting ? "…" : "annuler"}
                          </button>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>

                {olderMovements.length > 0 && session.length > 0 && (
                  <li className="pt-2 pb-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Plus tôt
                    </span>
                  </li>
                )}
                {olderMovements.map((m) => {
                  const isEntry = m.movement_type === "entry";
                  const time = m.created_at
                    ? new Date(m.created_at).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";
                  const techName = m.technician
                    ? `${m.technician.first_name} ${m.technician.last_name}`
                    : undefined;
                  return (
                    <li
                      key={m.id}
                      className={cn(
                        "rounded-lg border-l-2 px-3 py-2.5",
                        isEntry
                          ? "border-l-standard/50 bg-standard-bg/20"
                          : "border-l-critique/50 bg-critique-bg/20"
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className={cn(
                            "font-heading font-bold tabular-nums text-sm mt-0.5 shrink-0",
                            isEntry ? "text-standard" : "text-critique"
                          )}
                        >
                          {isEntry ? "+" : "−"}
                          {m.quantity}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate leading-tight">
                            {m.product?.name ?? "—"}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {MOVEMENT_LABELS[m.movement_type] ?? m.movement_type}
                            {techName && ` → ${techName}`}
                          </p>
                        </div>
                        {time && (
                          <span className="text-[10px] font-heading tabular-nums text-muted-foreground shrink-0 mt-0.5">
                            {time}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {session.length > 0 && (
              <div className="pt-2 border-t shrink-0">
                <button
                  onClick={() => {
                    const last = session[0];
                    if (last && !revertingIds.has(last.localId)) handleRevert(last);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
                >
                  <kbd className="bg-muted px-1 py-0.5 rounded font-mono">⌘Z</kbd> Annuler le
                  dernier
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
