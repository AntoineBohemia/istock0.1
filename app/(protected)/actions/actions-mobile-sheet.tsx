"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
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
  ChevronLeft,
  HardHat,
  Check,
  Clock,
  ScanLine,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { HeroNumber } from "@/components/ui/hero-number";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useProducts, useTechnicians, useStockMovements } from "@/hooks/queries";
import { useCreateStockEntry, useCreateStockExit } from "@/hooks/mutations";
import { calculateStockScore, getStockBadgeVariant } from "@/lib/utils/stock";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounce";

const QrScannerModal = dynamic(() => import("@/components/qr-scanner-modal"), { ssr: false });

// ─── Types ──────────────────────────────────────────────────
type ActionMode = "entry" | "exit_technician" | "exit_anonymous";

interface ConsoleProduct {
  id: string;
  name: string;
  sku: string | null;
  stock_current: number;
  stock_min: number | null;
  price: number | null;
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
  createdAt: string;
}

// ─── Constants ──────────────────────────────────────────────
const MOVEMENT_LABELS: Record<string, string> = {
  entry: "Entr\u00e9e",
  exit_technician: "Sortie technicien",
  exit_anonymous: "Sortie autre",
};

const ACTION_OPTIONS: {
  mode: ActionMode;
  label: string;
  icon: React.ElementType;
  color: string;
  borderColor: string;
}[] = [
  {
    mode: "entry",
    label: "Entr\u00e9e stock",
    icon: ArrowDownToLine,
    color: "text-standard",
    borderColor: "hover:border-standard",
  },
  {
    mode: "exit_technician",
    label: "Sortie technicien",
    icon: HardHat,
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

// ─── Helper: today string that refreshes every 60s ──────────
function useTodayString() {
  const [today, setToday] = useState(() => new Date().toISOString().split("T")[0]);
  useEffect(() => {
    const interval = setInterval(() => {
      setToday(new Date().toISOString().split("T")[0]);
    }, 60_000);
    return () => clearInterval(interval);
  }, []);
  return today;
}

// ═════════════════════════════════════════════════════════════
// Main Component
// ═════════════════════════════════════════════════════════════
export default function ActionsMobileSheet() {
  const prefersReducedMotion = useReducedMotion();
  const orgId = useOrganizationStore((s) => s.currentOrganization?.id);

  // ─── Today (recalculates every 60s) ─────────────────────
  const today = useTodayString();
  const [pageLoadTime] = useState(() => new Date().toISOString());

  // ─── Drawer state ───────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);

  // ─── Drawer inner navigation ────────────────────────────
  // For entry/exit_anonymous: "products" → "detail"
  // For exit_technician: "technicians" → "products" → "cart"
  type DrawerStep = "products" | "detail" | "technicians" | "cart";
  const [drawerStep, setDrawerStep] = useState<DrawerStep>("products");

  // ─── Search ─────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ─── Single product ─────────────────────────────────────
  const [product, setProduct] = useState<ConsoleProduct | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<string>("");
  const quantityInputRef = useRef<HTMLInputElement>(null);

  // ─── Technician (exit_technician) ───────────────────────
  const [technicianId, setTechnicianId] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  // ─── QR Scanner ────────────────────────────────────────
  const [scannerOpen, setScannerOpen] = useState(false);
  const [batchScanOpen, setBatchScanOpen] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<ConsoleProduct | null>(null);
  const [scanActionSheetOpen, setScanActionSheetOpen] = useState(false);

  // ─── Session journal ────────────────────────────────────
  const [session, setSession] = useState<SessionEntry[]>([]);
  const [revertingIds, setRevertingIds] = useState<Set<string>>(new Set());
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);

  // ─── Data ───────────────────────────────────────────────
  const { data: productsResult, isLoading: isSearching } = useProducts({
    organizationId: orgId,
    search: debouncedSearch || undefined,
  });
  // Full product list (no search filter) — used for QR scan lookup
  const { data: allProductsResult } = useProducts({ organizationId: orgId });
  const allProducts = useMemo(() => allProductsResult?.products ?? [], [allProductsResult]);

  const { data: techniciansData = [] } = useTechnicians(orgId);
  const searchResults = useMemo(() => productsResult?.products ?? [], [productsResult]);

  const sortedProducts = useMemo(() => {
    return [...searchResults].sort((a, b) => {
      const scoreA = calculateStockScore(a.stock_current ?? 0, a.stock_min);
      const scoreB = calculateStockScore(b.stock_current ?? 0, b.stock_min);
      return scoreA - scoreB;
    });
  }, [searchResults]);

  const filteredTechnicians = useMemo(() => {
    if (!debouncedSearch.trim()) return techniciansData;
    const q = debouncedSearch.toLowerCase();
    return techniciansData.filter((t) =>
      `${t.first_name} ${t.last_name}`.toLowerCase().includes(q)
    );
  }, [techniciansData, debouncedSearch]);

  // ─── Today's movements ─────────────────────────────────
  const { data: todayResult, isLoading: isLoadingToday } = useStockMovements({
    organizationId: orgId,
    startDate: today,
  });
  const olderMovements = (todayResult?.movements ?? []).filter(
    (m) => m.created_at && m.created_at < pageLoadTime
  );

  // ─── Mutations ─────────────────────────────────────────
  const createEntry = useCreateStockEntry();
  const createExit = useCreateStockExit();
  const isSubmitting = createEntry.isPending || createExit.isPending || isBatchSubmitting;

  // ─── Derived ───────────────────────────────────────────
  const selectedTech = useMemo(
    () => techniciansData.find((t) => t.id === technicianId),
    [techniciansData, technicianId]
  );
  const techFullName = selectedTech ? `${selectedTech.first_name} ${selectedTech.last_name}` : "";
  const cartTotalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const stockScore = product ? calculateStockScore(product.stock_current, product.stock_min) : 0;
  const stockStatus = product ? getStockBadgeVariant(stockScore) : "standard";

  const submitLabel = useMemo(() => {
    if (!actionMode) return "";
    const u = quantity > 1 ? "unit\u00e9s" : "unit\u00e9";
    if (actionMode === "entry") return `Entrer ${quantity} ${u}`;
    return `Sortir ${quantity} ${u}`;
  }, [actionMode, quantity]);

  // ─── Open drawer for a given action ────────────────────
  const openDrawer = useCallback((mode: ActionMode) => {
    setActionMode(mode);
    setSearchQuery("");
    setProduct(null);
    setQuantity(1);
    setUnitPrice("");
    setCart([]);
    setTechnicianId("");

    if (mode === "exit_technician") {
      setDrawerStep("technicians");
    } else {
      setDrawerStep("products");
    }
    setDrawerOpen(true);
  }, []);

  // ─── Close drawer (resets state) ───────────────────────
  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    // Delay cleanup so close animation finishes
    setTimeout(() => {
      setActionMode(null);
      setDrawerStep("products");
      setSearchQuery("");
      setProduct(null);
      setQuantity(1);
      setUnitPrice("");
      setCart([]);
      setTechnicianId("");
    }, 300);
  }, []);

  // ─── QR Scan result handler ──────────────────────────
  const handleScanResult = useCallback(
    (productId: string) => {
      setScannerOpen(false);
      navigator.vibrate?.(10);
      // Find the scanned product in FULL list (not search-filtered)
      const found = allProducts.find((p) => p.id === productId);
      if (found) {
        setScannedProduct({
          id: found.id,
          name: found.name,
          sku: found.sku,
          stock_current: found.stock_current ?? 0,
          stock_min: found.stock_min,
          price: found.price ?? null,
        });
        setScanActionSheetOpen(true);
      } else {
        toast.error("Produit non reconnu dans cette organisation");
      }
    },
    [allProducts]
  );

  // ─── Scan action sheet choices ─────────────────────
  const handleScanAction = useCallback(
    (mode: ActionMode) => {
      if (!scannedProduct) return;
      setScanActionSheetOpen(false);

      if (mode === "exit_technician") {
        // Open technician selection with this product pre-queued
        setActionMode("exit_technician");
        setSearchQuery("");
        setProduct(null);
        setCart([{ product: scannedProduct, quantity: 1 }]);
        setTechnicianId("");
        setDrawerStep("technicians");
        setDrawerOpen(true);
      } else {
        // Entry or exit_anonymous — go straight to detail
        setActionMode(mode);
        setSearchQuery("");
        setCart([]);
        setTechnicianId("");
        setProduct(scannedProduct);
        setQuantity(1);
        setUnitPrice(scannedProduct.price != null ? scannedProduct.price.toString() : "");
        setDrawerStep("detail");
        setDrawerOpen(true);
        setTimeout(() => quantityInputRef.current?.focus(), 200);
      }

      // Clear scanned product after a delay (let sheet close animation finish)
      setTimeout(() => setScannedProduct(null), 300);
    },
    [scannedProduct]
  );

  // ─── Batch scan handler (tech mode — continuous) ───
  const handleBatchScan = useCallback(
    (productId: string) => {
      const found = allProducts.find((p) => p.id === productId);
      if (!found) {
        toast.error("Produit non reconnu");
        return;
      }
      const consoleP: ConsoleProduct = {
        id: found.id,
        name: found.name,
        sku: found.sku,
        stock_current: found.stock_current ?? 0,
        stock_min: found.stock_min,
        price: found.price ?? null,
      };
      // Add to cart or increment qty
      setCart((prev) => {
        const existing = prev.find((item) => item.product.id === consoleP.id);
        if (existing) {
          return prev.map((item) =>
            item.product.id === consoleP.id
              ? { ...item, quantity: Math.min(item.quantity + 1, item.product.stock_current) }
              : item
          );
        }
        return [...prev, { product: consoleP, quantity: 1 }];
      });
      toast.success(found.name, { description: "Ajout\u00e9 au panier" });
    },
    [allProducts]
  );

  // ─── Select product (entry / exit_anonymous) ──────────
  const selectProductSingle = useCallback((p: ConsoleProduct) => {
    navigator.vibrate?.(10);
    setProduct(p);
    setQuantity(1);
    setUnitPrice(p.price != null ? p.price.toString() : "");
    setSearchQuery("");
    setDrawerStep("detail");
    setTimeout(() => quantityInputRef.current?.focus(), 100);
  }, []);

  // ─── Select product (exit_technician) — toggle cart ───
  const toggleProductInCart = useCallback((p: ConsoleProduct) => {
    navigator.vibrate?.(10);
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === p.id);
      if (existing) {
        return prev.filter((item) => item.product.id !== p.id);
      }
      return [...prev, { product: { ...p }, quantity: 1 }];
    });
  }, []);

  // ─── Select technician ────────────────────────────────
  const selectTechnician = useCallback((techId: string) => {
    navigator.vibrate?.(10);
    setTechnicianId(techId);
    setSearchQuery("");
    setDrawerStep("products");
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }, []);

  // ─── Clear technician ─────────────────────────────────
  const clearTechnician = useCallback(() => {
    setTechnicianId("");
    setCart([]);
    setDrawerStep("technicians");
    setSearchQuery("");
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

  const setCartQty = useCallback((productId: string, qty: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const newQty = Math.max(1, Math.min(qty, item.product.stock_current));
        return { ...item, quantity: newQty };
      })
    );
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  // ─── Go back within drawer ────────────────────────────
  const drawerGoBack = useCallback(() => {
    if (drawerStep === "cart") {
      setDrawerStep("products");
      setSearchQuery("");
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else if (drawerStep === "detail") {
      setProduct(null);
      setQuantity(1);
      setUnitPrice("");
      setDrawerStep("products");
      setSearchQuery("");
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else if (drawerStep === "products" && actionMode === "exit_technician") {
      clearTechnician();
    }
  }, [drawerStep, actionMode, clearTechnician]);

  // ─── Submit single (entry / exit_anonymous) ───────────
  const handleSubmit = useCallback(() => {
    if (!product || !orgId || isSubmitting || !actionMode) return;
    if (quantity < 1) return;

    const isEntry = actionMode === "entry";

    if (!isEntry && quantity > product.stock_current) {
      toast.error(`Stock insuffisant - disponible : ${product.stock_current}`);
      return;
    }

    const stockAfter = isEntry
      ? product.stock_current + quantity
      : product.stock_current - quantity;
    const localId = crypto.randomUUID();

    const onSuccess = () => {
      navigator.vibrate?.(10);
      setProduct((prev) => (prev ? { ...prev, stock_current: stockAfter } : prev));
      setSession((prev) => [
        {
          localId,
          movementType: actionMode,
          productId: product.id,
          productName: product.name,
          quantity,
          stockAfter,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      const sign = isEntry ? "+" : "-";
      toast.success(`${sign}${quantity} ${product.name} - ${stockAfter} en stock`);
      setQuantity(1);

      // Return to product list (rapid-fire mode)
      setProduct(null);
      setDrawerStep("products");
      setSearchQuery("");
      setTimeout(() => searchInputRef.current?.focus(), 100);
    };

    const onError = (error: Error) => {
      toast.error(error.message ?? "Erreur lors de l'enregistrement");
    };

    if (isEntry) {
      const parsedPrice = unitPrice ? parseFloat(unitPrice) : undefined;
      createEntry.mutate(
        {
          organizationId: orgId,
          productId: product.id,
          quantity,
          unitPrice: parsedPrice || undefined,
        },
        { onSuccess, onError }
      );
    } else {
      createExit.mutate(
        { organizationId: orgId, productId: product.id, quantity, type: actionMode },
        { onSuccess, onError }
      );
    }
  }, [product, orgId, quantity, actionMode, isSubmitting, createEntry, createExit]);

  // ─── Submit batch (exit_technician) ───────────────────
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
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        successCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        toast.error(`${item.product.name} : ${msg}`);
      }
    }

    setIsBatchSubmitting(false);

    if (successCount > 0) {
      navigator.vibrate?.(10);
      toast.success(
        `${successCount} produit${successCount > 1 ? "s" : ""} sorti${successCount > 1 ? "s" : ""} vers ${techFullName}`
      );
      setCart([]);
      setSearchQuery("");
      // Drawer stays open for rapid-fire
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [orgId, technicianId, cart, isBatchSubmitting, techFullName, createExit]);

  // ─── Revert session entry ─────────────────────────────
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
          `Annule - ${isEntryRevert ? "-" : "+"}${entry.quantity} ${entry.productName}`
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

  // ─── URL params (invited redirect + QR deep link) ────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("invited") === "true") {
      toast.success("Bienvenue ! Votre invitation a ete acceptee.");
      window.history.replaceState({}, "", "/actions");
    }
  }, []);

  // Handle ?product= deep link (native QR scan from camera app)
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current || allProducts.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const productId = params.get("product");
    if (!productId) return;

    deepLinkHandled.current = true;
    window.history.replaceState({}, "", "/actions");

    const found = allProducts.find((p) => p.id === productId);
    if (found) {
      // Schedule after render to avoid setState-in-effect lint error
      queueMicrotask(() => {
        setScannedProduct({
          id: found.id,
          name: found.name,
          sku: found.sku,
          stock_current: found.stock_current ?? 0,
          stock_min: found.stock_min,
          price: found.price ?? null,
        });
        setScanActionSheetOpen(true);
      });
    } else {
      queueMicrotask(() => toast.error("Produit non reconnu dans cette organisation"));
    }
  }, [allProducts]);

  // ─── Drawer title (for accessibility) ─────────────────
  const drawerTitle = useMemo(() => {
    if (actionMode === "entry") return "Entr\u00e9e stock";
    if (actionMode === "exit_technician") return "Sortie technicien";
    if (actionMode === "exit_anonymous") return "Sortie autre";
    return "Action";
  }, [actionMode]);

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════
  return (
    <div className="pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {/* ── Main Screen (always visible) ── */}
      <div className="space-y-6 px-1">
        {/* Action cards — 2x2 grid with scan as primary */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* QR Scan — primary action */}
          <button
            onClick={() => setScannerOpen(true)}
            className="flex items-center gap-3 rounded-2xl bg-foreground text-background px-4 py-4 active:scale-[0.97] transition-all col-span-2"
          >
            <ScanLine className="size-5" />
            <span className="font-semibold text-[15px]">Scanner un QR code</span>
          </button>

          {/* 3 action buttons */}
          {ACTION_OPTIONS.map(({ mode, label, icon: Icon, color }) => (
            <button
              key={mode}
              onClick={() => openDrawer(mode)}
              className="flex items-center gap-2.5 rounded-xl border bg-white dark:bg-card px-3.5 py-3 active:scale-[0.97] transition-all"
            >
              <Icon className={cn("shrink-0 size-[18px]", color)} />
              <span className="font-medium text-[13px] text-left leading-tight">{label}</span>
            </button>
          ))}
        </div>

        {/* ── HISTORIQUE DU JOUR (always visible) ── */}
        <div className="space-y-3">
          <h3 className="font-heading text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">
            Historique du jour
          </h3>

          {session.length === 0 && olderMovements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              {isLoadingToday ? (
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <Clock className="size-10 text-muted-foreground/20 mb-2" />
                  <p className="text-sm text-muted-foreground">Aucun mouvement aujourd&apos;hui.</p>
                </>
              )}
            </div>
          ) : (
            <ul className="space-y-1.5">
              {/* Session entries (current session, with undo) */}
              <AnimatePresence initial={false}>
                {session.map((entry) => {
                  const isEntry = entry.movementType === "entry";
                  const reverting = revertingIds.has(entry.localId);
                  const time = new Date(entry.createdAt).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
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
                          {isEntry ? "+" : "-"}
                          {entry.quantity}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate">{entry.productName}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {MOVEMENT_LABELS[entry.movementType]}
                            {entry.technicianName && ` \u2192 ${entry.technicianName}`}
                          </p>
                        </div>
                        <span className="text-[10px] font-heading tabular-nums text-muted-foreground shrink-0">
                          {time}
                        </span>
                        <button
                          onClick={() => handleRevert(entry)}
                          disabled={reverting}
                          className="text-[11px] text-muted-foreground active:text-foreground shrink-0 disabled:opacity-30 min-h-[44px] flex items-center px-1"
                        >
                          {reverting ? "\u2026" : "annuler"}
                        </button>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>

              {/* Separator if both session + older exist */}
              {olderMovements.length > 0 && session.length > 0 && (
                <li className="pt-2 pb-1 px-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Plus tot
                  </span>
                </li>
              )}

              {/* Older movements (before page load) */}
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
                const typeLabel =
                  m.movement_type === "exit_anonymous"
                    ? "Sortie autre"
                    : (MOVEMENT_LABELS[m.movement_type] ?? m.movement_type);
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
                        {isEntry ? "+" : "-"}
                        {m.quantity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate">
                          {m.product?.name ?? "\u2014"}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {typeLabel}
                          {techName && ` \u2192 ${techName}`}
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

      {/* ═══════════════════════════════════════════════════════ */}
      {/* DRAWER                                                 */}
      {/* ═══════════════════════════════════════════════════════ */}
      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!open && !batchScanOpen) closeDrawer();
        }}
      >
        <DrawerContent className="max-h-[92vh] flex flex-col">
          {/* Accessible title (visually hidden — grab handle + step label handle visual) */}
          <DrawerTitle className="sr-only">{drawerTitle}</DrawerTitle>

          {/* ── Drawer header ── */}
          <div className="px-4 pt-3 pb-2 shrink-0">
            <div className="flex items-center justify-between">
              {/* Back / step label */}
              <div className="flex items-center gap-2">
                {(drawerStep === "detail" ||
                  drawerStep === "cart" ||
                  (drawerStep === "products" && actionMode === "exit_technician")) && (
                  <button
                    onClick={drawerGoBack}
                    className="flex items-center gap-0.5 text-sm text-muted-foreground active:text-foreground transition-colors min-h-[44px] pr-2"
                  >
                    <ChevronLeft className="size-4" />
                    Retour
                  </button>
                )}
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {drawerTitle}
                </p>
              </div>
              {/* Close */}
              <button
                onClick={closeDrawer}
                className="text-muted-foreground active:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Technician chip + scan button (exit_technician mode, products step) */}
            {actionMode === "exit_technician" && drawerStep === "products" && technicianId && (
              <div className="mt-1 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium">
                  {techFullName}
                  <button
                    onClick={clearTechnician}
                    className="hover:bg-primary/20 rounded-full p-0.5 -mr-0.5 min-h-[28px] min-w-[28px] flex items-center justify-center"
                  >
                    <X className="size-3" />
                  </button>
                </span>
                <button
                  onClick={() => setBatchScanOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-foreground text-background px-3.5 py-2 text-xs font-medium active:scale-[0.97] transition-all"
                >
                  <ScanLine className="size-3.5" />
                  Scanner
                </button>
              </div>
            )}

            {/* Search input (products + technicians steps) */}
            {(drawerStep === "products" || drawerStep === "technicians") && (
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  ref={searchInputRef}
                  placeholder={
                    drawerStep === "technicians"
                      ? "Rechercher un technicien\u2026"
                      : technicianId
                        ? `Ajouter un produit pour ${techFullName}\u2026`
                        : "Rechercher un produit\u2026"
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setSearchQuery("");
                      searchInputRef.current?.blur();
                    }
                  }}
                  className="pl-9 h-11 text-base bg-muted/50 rounded-xl"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground active:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Drawer body (scrollable) ── */}
          <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <AnimatePresence mode="wait" initial={false}>
              {/* ═══ TECHNICIAN LIST (exit_technician, step 1) ═══ */}
              {drawerStep === "technicians" && (
                <motion.div
                  key="technicians"
                  initial={prefersReducedMotion ? false : { opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2 pt-1"
                >
                  {filteredTechnicians.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {filteredTechnicians.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => selectTechnician(t.id)}
                          className={cn(
                            "flex items-center gap-2.5 rounded-xl border bg-card transition-all active:scale-[0.97]",
                            "hover:border-primary/40",
                            "p-3 min-h-[56px]"
                          )}
                        >
                          <div className="size-9 rounded-full bg-muted flex items-center justify-center font-semibold shrink-0 text-xs">
                            {t.first_name[0]}
                            {t.last_name[0]}
                          </div>
                          <span className="text-sm font-medium text-left leading-tight">
                            {t.first_name} {t.last_name}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <HardHat className="size-10 text-muted-foreground/20 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {debouncedSearch ? "Aucun technicien trouve." : "Aucun technicien."}
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ═══ PRODUCT LIST ═══ */}
              {drawerStep === "products" && (
                <motion.div
                  key="products"
                  initial={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2 pt-1"
                >
                  {isSearching && debouncedSearch ? (
                    <div className="py-12 text-center">
                      <Loader2 className="size-5 animate-spin text-muted-foreground mx-auto" />
                    </div>
                  ) : sortedProducts.length > 0 ? (
                    <ul className="space-y-1">
                      {sortedProducts.map((p) => {
                        const score = calculateStockScore(p.stock_current ?? 0, p.stock_min);
                        const status = getStockBadgeVariant(score);
                        const inCart = cart.some((item) => item.product.id === p.id);
                        const consoleP: ConsoleProduct = {
                          id: p.id,
                          name: p.name,
                          sku: p.sku,
                          stock_current: p.stock_current ?? 0,
                          stock_min: p.stock_min,
                          price: p.price ?? null,
                        };
                        return (
                          <li key={p.id}>
                            <button
                              onClick={() =>
                                actionMode === "exit_technician"
                                  ? toggleProductInCart(consoleP)
                                  : selectProductSingle(consoleP)
                              }
                              className={cn(
                                "w-full flex items-center gap-3 rounded-xl px-3 py-3 transition-all active:scale-[0.98] min-h-[56px]",
                                "hover:bg-muted/60",
                                inCart && "bg-primary/5 ring-1 ring-primary/30",
                                !inCart && status === "critique" && "bg-critique-bg/20",
                                !inCart && status === "attention" && "bg-attention-bg/20"
                              )}
                            >
                              {/* In-cart checkmark */}
                              {actionMode === "exit_technician" && (
                                <div
                                  className={cn(
                                    "size-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                                    inCart
                                      ? "bg-primary border-primary"
                                      : "border-muted-foreground/30"
                                  )}
                                >
                                  {inCart && <Check className="size-3.5 text-primary-foreground" />}
                                </div>
                              )}

                              {/* Product info */}
                              <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-medium leading-tight truncate">
                                  {p.name}
                                </p>
                                {p.sku && (
                                  <p className="text-[11px] text-muted-foreground font-mono truncate">
                                    {p.sku}
                                  </p>
                                )}
                              </div>

                              {/* Stock + pill */}
                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className={cn(
                                    "font-heading font-bold tabular-nums text-base",
                                    status === "critique" && "text-critique",
                                    status === "attention" && "text-attention"
                                  )}
                                >
                                  {p.stock_current ?? 0}
                                </span>
                                <StatusPill status={status} />
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Package className="size-10 text-muted-foreground/20 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {debouncedSearch ? "Aucun produit trouve." : "Aucun produit."}
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ═══ PRODUCT DETAIL (entry / exit_anonymous) ═══ */}
              {drawerStep === "detail" && product && (
                <motion.div
                  key="detail"
                  initial={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5 pt-1"
                >
                  {/* Product header + live stock preview */}
                  {(() => {
                    const isEntry = actionMode === "entry";
                    const previewStock = isEntry
                      ? product.stock_current + quantity
                      : Math.max(0, product.stock_current - quantity);
                    const previewScore = calculateStockScore(previewStock, product.stock_min);
                    const previewStatus = getStockBadgeVariant(previewScore);
                    return (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h2 className="font-heading text-[17px] font-semibold leading-tight">
                            {product.name}
                          </h2>
                          {product.sku && (
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">
                              {product.sku}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-sm text-muted-foreground tabular-nums">
                              {product.stock_current}
                            </span>
                            <span className="text-muted-foreground">{"\u2192"}</span>
                            <span
                              className={cn(
                                "font-heading font-bold text-2xl tabular-nums",
                                previewStatus === "critique" && "text-critique",
                                previewStatus === "attention" && "text-attention"
                              )}
                            >
                              {previewStock}
                            </span>
                          </div>
                          <div className="mt-0.5">
                            <StatusPill status={previewStatus} />
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Quantity stepper */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="size-12 rounded-xl bg-muted/60 flex items-center justify-center active:bg-muted shrink-0 disabled:opacity-30 min-h-[44px]"
                    >
                      <Minus className="size-5" />
                    </button>
                    <Input
                      ref={quantityInputRef}
                      type="number"
                      min={1}
                      max={actionMode !== "entry" ? product.stock_current : undefined}
                      value={quantity}
                      onChange={(e) => {
                        const max = actionMode !== "entry" ? product.stock_current : Infinity;
                        setQuantity(Math.max(1, Math.min(parseInt(e.target.value) || 1, max)));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          navigator.vibrate?.(10);
                          handleSubmit();
                        }
                      }}
                      className="flex-1 h-12 text-2xl font-heading font-bold tabular-nums text-center rounded-xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => {
                        const max = actionMode !== "entry" ? product.stock_current : Infinity;
                        setQuantity((q) => Math.min(q + 1, max));
                      }}
                      disabled={actionMode !== "entry" && quantity >= product.stock_current}
                      className="size-12 rounded-xl bg-muted/60 flex items-center justify-center active:bg-muted shrink-0 disabled:opacity-30 min-h-[44px]"
                    >
                      <Plus className="size-5" />
                    </button>
                  </div>

                  {/* Unit price (entry mode only) */}
                  {actionMode === "entry" && (
                    <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
                      <span className="text-[13px] text-muted-foreground">Prix HT</span>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder="\u2014"
                          value={unitPrice}
                          onChange={(e) => setUnitPrice(e.target.value)}
                          className="w-20 h-8 text-right text-sm rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-[13px] text-muted-foreground">{"\u20AC"}</span>
                      </div>
                    </div>
                  )}

                  {/* Total (entry mode — always rendered to avoid layout shift) */}
                  {actionMode === "entry" && (
                    <p
                      className={cn(
                        "text-right text-xs tabular-nums px-1 h-4",
                        quantity > 1 && unitPrice && parseFloat(unitPrice) > 0
                          ? "text-muted-foreground"
                          : "invisible"
                      )}
                    >
                      {quantity} {"\u00D7"}{" "}
                      {(unitPrice ? parseFloat(unitPrice) : 0).toLocaleString("fr-FR", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      {"\u20AC"} ={" "}
                      <span className="font-medium text-foreground">
                        {(quantity * (unitPrice ? parseFloat(unitPrice) : 0)).toLocaleString(
                          "fr-FR",
                          {
                            minimumFractionDigits: 2,
                          }
                        )}{" "}
                        {"\u20AC"}
                      </span>
                    </p>
                  )}
                </motion.div>
              )}

              {/* ═══ CART REVIEW (exit_technician, step 3) ═══ */}
              {drawerStep === "cart" && (
                <motion.div
                  key="cart"
                  initial={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={prefersReducedMotion ? undefined : { opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4 pt-1"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {cart.length} produit{cart.length > 1 ? "s" : ""} &middot; {cartTotalItems}{" "}
                      unit{"\u00E9"}s
                    </p>
                    <button
                      onClick={() => {
                        setDrawerStep("products");
                        setSearchQuery("");
                        setTimeout(() => searchInputRef.current?.focus(), 100);
                      }}
                      className="text-xs text-primary font-medium"
                    >
                      + Ajouter
                    </button>
                  </div>

                  <ul className="space-y-1">
                    {cart.map((item) => (
                      <li
                        key={item.product.id}
                        className="flex items-center gap-3 rounded-xl bg-muted/30 px-3 py-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-medium truncate">{item.product.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            dispo {item.product.stock_current}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateCartQty(item.product.id, -1)}
                            disabled={item.quantity <= 1}
                            className="size-10 rounded-xl bg-muted/60 flex items-center justify-center active:bg-muted disabled:opacity-30 min-h-[44px]"
                          >
                            <Minus className="size-4" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={item.product.stock_current}
                            value={item.quantity}
                            onChange={(e) =>
                              setCartQty(
                                item.product.id,
                                Math.min(parseInt(e.target.value) || 1, item.product.stock_current)
                              )
                            }
                            className="w-10 text-center font-heading font-bold tabular-nums text-base bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            onClick={() => updateCartQty(item.product.id, 1)}
                            disabled={item.quantity >= item.product.stock_current}
                            className="size-10 rounded-xl bg-muted/60 flex items-center justify-center active:bg-muted disabled:opacity-30 min-h-[44px]"
                          >
                            <Plus className="size-4" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="size-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center active:bg-destructive/20 transition-colors"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Sticky bottom button (detail + cart steps) ── */}
          {drawerStep === "detail" && product && (
            <div className="shrink-0 border-t bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <Button
                className="w-full h-12 text-[15px] active:scale-[0.97]"
                onClick={() => {
                  navigator.vibrate?.(10);
                  handleSubmit();
                }}
                disabled={
                  isSubmitting ||
                  quantity < 1 ||
                  (actionMode !== "entry" && quantity > product.stock_current)
                }
                variant="default"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> En cours&hellip;
                  </>
                ) : (
                  submitLabel
                )}
              </Button>
            </div>
          )}

          {actionMode === "exit_technician" && drawerStep === "cart" && cart.length > 0 && (
            <div className="shrink-0 border-t bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <Button
                onClick={handleBatchSubmit}
                disabled={isSubmitting || cart.length === 0}
                className="w-full h-12 text-[15px] active:scale-[0.97]"
              >
                {isBatchSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> En cours&hellip;
                  </>
                ) : (
                  <>Valider la sortie vers {techFullName}</>
                )}
              </Button>
            </div>
          )}

          {/* ── "Voir le panier" floating button (products step, tech mode) ── */}
          {actionMode === "exit_technician" && drawerStep === "products" && cart.length > 0 && (
            <div className="shrink-0 border-t bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <Button
                onClick={() => setDrawerStep("cart")}
                className="w-full h-12 text-[15px] active:scale-[0.97]"
              >
                <Package className="size-4" />
                Voir le panier ({cart.length} produit{cart.length > 1 ? "s" : ""} &middot;{" "}
                {cartTotalItems} unit{"\u00E9"}s)
              </Button>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* ── QR Scanner Modal (single) ── */}
      <QrScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScanResult}
      />

      {/* ── QR Scanner Modal (batch — tech mode) ── */}
      <QrScannerModal
        open={batchScanOpen}
        onClose={() => {
          setBatchScanOpen(false);
          // Reopen drawer on cart step if items were scanned
          if (cart.length > 0) {
            setDrawerStep("cart");
            setDrawerOpen(true);
          }
        }}
        onScan={handleBatchScan}
        continuous
        title={`Scanner pour ${techFullName}`}
        bottomContent={
          cart.length > 0 ? (
            <button
              onClick={() => {
                setBatchScanOpen(false);
                setDrawerStep("cart");
                setDrawerOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-foreground py-3 font-semibold text-[15px] active:scale-[0.97] transition-all"
            >
              <Package className="size-4" />
              Voir le panier ({cart.length} produit{cart.length > 1 ? "s" : ""})
            </button>
          ) : undefined
        }
      />

      {/* ── Scan Action Sheet (choose action after scan) ── */}
      <Drawer open={scanActionSheetOpen} onOpenChange={setScanActionSheetOpen}>
        <DrawerContent className="pb-[env(safe-area-inset-bottom)]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="sr-only">Action pour {scannedProduct?.name}</DrawerTitle>
            <DrawerDescription className="sr-only">
              Choisissez une action pour ce produit
            </DrawerDescription>
          </DrawerHeader>

          {scannedProduct && (
            <>
              {/* Product info */}
              <div className="flex items-center gap-3 mx-4 mb-3 px-1">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[15px] truncate">{scannedProduct.name}</p>
                  {scannedProduct.sku && (
                    <p className="text-xs text-muted-foreground font-mono">{scannedProduct.sku}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-heading font-bold text-lg tabular-nums">
                    {scannedProduct.stock_current}
                  </span>
                  <StatusPill
                    status={getStockBadgeVariant(
                      calculateStockScore(scannedProduct.stock_current, scannedProduct.stock_min)
                    )}
                  />
                </div>
              </div>

              {/* Action buttons — iOS-style list */}
              <div className="mx-4 mb-4 rounded-xl border divide-y overflow-hidden">
                {(
                  [
                    {
                      mode: "entry",
                      label: "Entr\u00e9e stock",
                      icon: ArrowDownToLine,
                      color: "text-standard",
                    },
                    {
                      mode: "exit_anonymous",
                      label: "Sortie autre",
                      icon: ArrowUpFromLine,
                      color: "text-critique",
                    },
                    {
                      mode: "exit_technician",
                      label: "Sortie technicien",
                      icon: HardHat,
                      color: "text-primary",
                    },
                  ] as const
                ).map(({ mode, label, icon: ActionIcon, color }) => (
                  <button
                    key={mode}
                    onClick={() => handleScanAction(mode)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 min-h-[48px] active:bg-muted/60 transition-colors"
                  >
                    <ActionIcon className={cn("size-[18px] shrink-0", color)} />
                    <span className="font-medium text-[15px]">{label}</span>
                    <ChevronLeft className="size-4 text-muted-foreground/40 ml-auto rotate-180" />
                  </button>
                ))}
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
