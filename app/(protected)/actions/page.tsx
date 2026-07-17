"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { toast } from "@/lib/toast";
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
  ChevronLeft,
  PackagePlus,
  Check,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { StatusPill } from "@/components/ui/status-pill";
import { HeroNumber } from "@/components/ui/hero-number";

import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useProducts, useTechnicians, useStockMovements } from "@/hooks/queries";
import { useCreateStockEntry, useCreateStockExit } from "@/hooks/mutations";
import { calculateStockScore, getStockBadgeVariant } from "@/lib/utils/stock";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

const ActionsMobileSheet = dynamic(() => import("./actions-mobile-sheet"), { ssr: false });

const MOVEMENT_LABELS: Record<string, string> = {
  entry: "Entrée",
  exit_technician: "Sortie technicien",
  exit_anonymous: "Erreur stock",
};

type ActionMode = "entry" | "exit_technician" | "exit_anonymous";
type FlowStep = "action" | "technician" | "product" | "detail";

const ACTION_OPTIONS: {
  mode: ActionMode;
  label: string;
  icon: React.ElementType;
  color: string;
  borderColor: string;
}[] = [
  {
    mode: "entry",
    label: "Entrée stock",
    icon: ArrowDownToLine,
    color: "text-standard",
    borderColor: "hover:border-standard",
  },
  {
    mode: "exit_technician",
    label: "Sortie technicien",
    icon: PackagePlus,
    color: "text-primary",
    borderColor: "hover:border-primary",
  },
  {
    mode: "exit_anonymous",
    label: "Sortie autre",
    icon: ArrowUpFromLine,
    color: "text-critique",
    borderColor: "hover:border-critique",
  },
];

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
  const orgId = useOrganizationStore((s) => s.currentOrganization?.id);

  // Show welcome toast if redirected from invite acceptance
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("invited") === "true") {
      toast.success("Bienvenue ! Votre invitation a été acceptée.");
      window.history.replaceState({}, "", "/actions");
    }
  }, []);

  // Mode
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);
  const [technicianId, setTechnicianId] = useState("");

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Single product (mode entrée / sortie autre)
  const [product, setProduct] = useState<ConsoleProduct | null>(null);

  // Multi-product cart (mode sortie technicien)
  const [cart, setCart] = useState<CartItem[]>([]);

  // Quantité (single product mode)
  const [quantity, setQuantity] = useState<number>(1);
  const [invoiceRef, setInvoiceRef] = useState("");
  const quantityInputRef = useRef<HTMLInputElement>(null);

  // Journal
  const [session, setSession] = useState<SessionEntry[]>([]);
  const [revertingIds, setRevertingIds] = useState<Set<string>>(new Set());
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);

  // ─── Derived step ───────────────────────────────────────
  const step: FlowStep =
    actionMode === null
      ? "action"
      : actionMode === "exit_technician" && !technicianId
        ? "technician"
        : product && actionMode !== "exit_technician"
          ? "detail"
          : "product";

  // ─── Data ──────────────────────────────────────────────
  const { data: productsResult, isLoading: isSearching } = useProducts({
    organizationId: orgId,
    search: step === "product" ? searchQuery || undefined : undefined,
  });
  const { data: techniciansData = [] } = useTechnicians(orgId);
  const searchResults = useMemo(() => productsResult?.products ?? [], [productsResult]);

  // Sort products by criticality (most critical first)
  const sortedProducts = useMemo(() => {
    return [...searchResults].sort((a, b) => {
      const scoreA = calculateStockScore(a.stock_current ?? 0, a.stock_min);
      const scoreB = calculateStockScore(b.stock_current ?? 0, b.stock_min);
      return scoreA - scoreB;
    });
  }, [searchResults]);

  const filteredTechnicians = useMemo(() => {
    if (!searchQuery.trim()) return techniciansData;
    const q = searchQuery.toLowerCase();
    return techniciansData.filter((t) =>
      `${t.first_name} ${t.last_name}`.toLowerCase().includes(q)
    );
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

  // ─── Navigation ─────────────────────────────────────────
  const goBack = useCallback(() => {
    setSearchQuery("");
    if (step === "detail") {
      setProduct(null);
      setQuantity(1);
      setTimeout(() => searchInputRef.current?.focus(), 60);
    } else if (step === "product" && actionMode === "exit_technician") {
      setTechnicianId("");
      setCart([]);
    } else {
      setActionMode(null);
      setTechnicianId("");
      setProduct(null);
      setCart([]);
      setQuantity(1);
      setInvoiceRef("");
    }
  }, [step, actionMode]);

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
        setTimeout(() => searchInputRef.current?.focus(), 60);
      } else {
        // Mode single : sélectionner le produit
        setProduct(p);
        setSearchQuery("");
        setQuantity(1);
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
    setQuantity(1);
    setTimeout(() => searchInputRef.current?.focus(), 60);
  }, []);

  // ─── Retirer le technicien ────────────────────────────
  const clearTechnician = useCallback(() => {
    setTechnicianId("");
    setActionMode(null);
    setProduct(null);
    setCart([]);
    setQuantity(1);
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
    if (step === "technician") return "Rechercher un technicien…";
    if (technicianId && techFullName) return `Ajouter un produit pour ${techFullName}…`;
    return "Rechercher un produit…";
  }, [step, technicianId, techFullName]);

  // ─── Label du bouton (single mode) ────────────────────
  const submitLabel = useMemo(() => {
    if (!actionMode) return "";
    const u = quantity > 1 ? "unités" : "unité";
    if (actionMode === "entry") return `Entrer ${quantity} ${u}`;
    return `Sortie ${quantity} ${u}`;
  }, [actionMode, quantity]);

  // ─── Step label ───────────────────────────────────────
  const stepLabel = useMemo(() => {
    if (actionMode === "entry") return "Entrée stock";
    if (actionMode === "exit_technician") return "Sortie technicien";
    if (actionMode === "exit_anonymous") return "Sortie autre";
    return "";
  }, [actionMode]);

  // ─── Soumission single ────────────────────────────────
  const handleSubmit = useCallback(() => {
    if (!product || !orgId || isSubmitting || !actionMode) return;
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
      setInvoiceRef("");

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
        {
          organizationId: orgId,
          productId: product.id,
          quantity,
          invoiceReference: invoiceRef || undefined,
        },
        { onSuccess, onError }
      );
    } else {
      createExit.mutate(
        { organizationId: orgId, productId: product.id, quantity, type: actionMode },
        { onSuccess, onError }
      );
    }
  }, [product, orgId, quantity, actionMode, isSubmitting, invoiceRef, createEntry, createExit]);

  // ─── Soumission batch (mode technicien) ───────────────
  const handleBatchSubmit = useCallback(async () => {
    if (!orgId || !technicianId || cart.length === 0 || isBatchSubmitting) return;

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
          },
          { onSuccess, onError }
        );
      } else {
        createEntry.mutate(
          {
            organizationId: orgId,
            productId: entry.productId,
            quantity: entry.quantity,
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

  // ─── Shared sub-renders ─────────────────────────────────

  const renderBackButton = (className?: string) => (
    <button
      onClick={goBack}
      className={cn(
        "flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors active:scale-[0.97]",
        className
      )}
    >
      <ChevronLeft className="size-4" />
      Retour
    </button>
  );

  const renderActionCards = (compact?: boolean) => (
    <div className={cn("grid gap-3", compact ? "grid-cols-3" : "grid-cols-3")}>
      {ACTION_OPTIONS.map(({ mode, label, icon: Icon, color, borderColor }) => (
        <button
          key={mode}
          onClick={() => setActionMode(mode)}
          className={cn(
            "group flex flex-col items-center justify-center gap-3 rounded-2xl border bg-card cursor-pointer",
            "transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0",
            borderColor,
            compact ? "py-6 px-3" : "py-10 px-6"
          )}
        >
          <Icon className={cn("shrink-0", color, compact ? "size-6" : "size-7")} />
          <span
            className={cn(
              "font-heading font-semibold text-center leading-tight",
              compact ? "text-xs" : "text-sm"
            )}
          >
            {label}
          </span>
        </button>
      ))}
    </div>
  );

  const renderProductCard = (p: (typeof searchResults)[number], compact?: boolean) => {
    const score = calculateStockScore(p.stock_current ?? 0, p.stock_min);
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
        className={cn(
          "relative aspect-square rounded-xl border bg-card p-3 flex flex-col justify-between text-left transition-all shadow-sm",
          "hover:border-primary/40 hover:shadow-md active:scale-[0.97]",
          inCart && "ring-2 ring-primary border-primary/30 bg-primary/5",
          !inCart && status === "critique" && "border-critique/30",
          !inCart && status === "attention" && "border-attention/30"
        )}
      >
        {inCart && (
          <div className="absolute top-1.5 right-1.5 size-5 rounded-full bg-primary flex items-center justify-center">
            <Check className="size-3 text-primary-foreground" />
          </div>
        )}
        <p
          className={cn(
            "font-medium leading-tight line-clamp-2",
            compact ? "text-[11px]" : "text-xs"
          )}
        >
          {p.name}
        </p>
        <div className="flex items-end justify-between">
          <span
            className={cn(
              "font-heading font-bold tabular-nums",
              compact ? "text-lg" : "text-xl",
              status === "critique" && "text-critique",
              status === "attention" && "text-attention"
            )}
          >
            {p.stock_current ?? 0}
          </span>
          <StatusPill status={status} />
        </div>
      </button>
    );
  };

  const renderTechnicianCard = (t: (typeof techniciansData)[number], compact?: boolean) => (
    <button
      key={t.id}
      onClick={() => selectTechnician(t.id)}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card shadow-sm transition-all active:scale-[0.97]",
        "hover:border-primary/40 hover:shadow-md",
        compact ? "p-3 gap-2" : "p-4"
      )}
    >
      <div
        className={cn(
          "rounded-full bg-muted flex items-center justify-center font-semibold shrink-0",
          compact ? "size-8 text-xs" : "size-10 text-sm"
        )}
      >
        {t.first_name[0]}
        {t.last_name[0]}
      </div>
      <span className={cn("font-medium", compact ? "text-xs" : "text-sm")}>
        {t.first_name} {t.last_name}
      </span>
    </button>
  );

  const renderSearchInput = (autoFocus?: boolean) => (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
      <Input
        ref={searchInputRef}
        placeholder={searchPlaceholder}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setSearchQuery("");
            searchInputRef.current?.blur();
          }
        }}
        className="pl-9 h-11 text-base bg-card rounded-xl shadow-sm"
        autoFocus={autoFocus}
      />
      {searchQuery && (
        <button
          onClick={() => {
            setSearchQuery("");
            searchInputRef.current?.focus();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );

  const renderCart = (compact?: boolean) => {
    if (!technicianId || cart.length === 0) return null;
    return (
      <div className={cn("rounded-xl border bg-card space-y-3", compact ? "p-3" : "p-4")}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Panier
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
                <p className="text-xs text-muted-foreground">dispo {item.product.stock_current}</p>
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
                className="text-muted-foreground hover:text-destructive transition-colors"
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
          className={cn("w-full", compact ? "h-10" : "h-12 text-base")}
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
    );
  };

  const renderDesktopHistory = () => (
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
            <div className="w-full space-y-2 px-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5">
                  <Skeleton className="h-4 w-8 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
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
          {session.map((entry) => {
            const isEntry = entry.movementType === "entry";
            const reverting = revertingIds.has(entry.localId);
            return (
              <li
                key={entry.localId}
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
              </li>
            );
          })}

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
            <kbd className="bg-muted px-1 py-0.5 rounded font-mono">⌘Z</kbd> Annuler le dernier
          </button>
        </div>
      )}
    </div>
  );

  // ════════════════════════════════════════════════════════
  return (
    <>
      {/* ═══════ MOBILE ═══════ */}
      <div className="md:hidden">
        <ActionsMobileSheet />
      </div>

      {/* ═══════ DESKTOP ═══════ */}
      <div className="hidden md:flex flex-col gap-4" style={{ height: "calc(100vh - 6rem)" }}>
        <div className="grid grid-cols-[1fr_300px] gap-4 flex-1 min-h-0">
          {/* ── Main panel ── */}
          <div className="rounded-lg border bg-card p-6 flex flex-col gap-5 overflow-y-auto">
            {/* Back button */}
            {step !== "action" && renderBackButton()}

            {/* Step 1: Choose action */}
            {step === "action" && (
              <div className="flex-1 flex flex-col items-center justify-center -mt-12">
                <div className="w-full max-w-lg">
                  <h2 className="font-heading font-semibold text-lg mb-5">Actions rapides</h2>
                  {renderActionCards()}
                </div>
              </div>
            )}

            {/* Step 2: Choose technician */}
            {step === "technician" && (
              <>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Sortie technicien
                  </p>
                  <h2 className="font-heading text-xl font-semibold">Sélectionner un technicien</h2>
                </div>
                {techniciansData.length > 5 && renderSearchInput(true)}
                {filteredTechnicians.length > 0 ? (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredTechnicians.map((t) => renderTechnicianCard(t))}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-12">
                    <p className="text-sm text-muted-foreground">
                      {searchQuery ? "Aucun technicien trouvé." : "Aucun technicien."}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Step 3: Product grid */}
            {step === "product" && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      {stepLabel}
                    </p>
                    {technicianId ? (
                      <div className="flex items-center gap-2">
                        <h2 className="font-heading text-xl font-semibold">{techFullName}</h2>
                        <button
                          onClick={clearTechnician}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <h2 className="font-heading text-xl font-semibold">
                        Sélectionner un produit
                      </h2>
                    )}
                  </div>
                </div>

                {renderSearchInput(true)}

                {isSearching && searchQuery ? (
                  <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 py-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="aspect-square rounded-xl" />
                    ))}
                  </div>
                ) : sortedProducts.length > 0 ? (
                  <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {sortedProducts.map((p) => renderProductCard(p))}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-12">
                    <Package className="size-14 text-muted-foreground opacity-20" />
                    <p className="text-sm text-muted-foreground">
                      {searchQuery ? "Aucun produit trouvé." : "Aucun produit."}
                    </p>
                  </div>
                )}

                {renderCart()}
              </>
            )}

            {/* Step 4: Product detail (single mode) */}
            {step === "detail" && product && (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      {stepLabel}
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
                      setQuantity(1);
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

                {actionMode === "entry" && (
                  <Input
                    type="text"
                    placeholder="Réf. facture (optionnel)"
                    value={invoiceRef}
                    onChange={(e) => setInvoiceRef(e.target.value)}
                    className="text-sm bg-white dark:bg-card"
                  />
                )}

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
                      Entrer en stock
                    </Button>
                  )}
                </div>
                <div className="flex-1" />
              </>
            )}
          </div>

          {/* ── History panel ── */}
          {renderDesktopHistory()}
        </div>
      </div>
    </>
  );
}
