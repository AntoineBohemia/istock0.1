"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion } from "motion/react";
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
  Clock,
  ScanLine,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import ProductIconDisplay from "@/components/product-icon-display";

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
import { MOVEMENT_TYPE_LABELS, isPositiveMovement } from "@/lib/supabase/queries/stock-movements";
import { MobileStackScreen, InsetGroup, InsetRow } from "./mobile-stack-screen";
import { MobileSplash } from "./mobile-splash";

const QrScannerModal = dynamic(() => import("@/components/qr-scanner-modal"), { ssr: false });

// ─── Types ──────────────────────────────────────────────────
// L'ecran d'accueil ne pose qu'une question : ca rentre ou ca sort.
// Le motif d'une sortie (technicien ou erreur de stock) se choisit ensuite ;
// c'est lui qui determine le type de mouvement enregistre.
type ActionMode = "entry" | "exit";
type ExitReason = "technician" | "loss";
type MovementKind = "entry" | "exit_technician" | "exit_anonymous" | "exit_loss";

interface ConsoleProduct {
  id: string;
  name: string;
  sku: string | null;
  stock_current: number;
  stock_min: number | null;
  price: number | null;
  icon_name?: string | null;
  icon_color?: string | null;
  image_url?: string | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
}

interface CartItem {
  product: ConsoleProduct;
  quantity: number;
}

interface SessionEntry {
  localId: string;
  movementType: MovementKind;
  productId: string;
  productName: string;
  quantity: number;
  stockAfter: number;
  technicianName?: string;
  createdAt: string;
}

// ─── Constants ──────────────────────────────────────────────
const ACTION_OPTIONS: {
  mode: ActionMode;
  label: string;
  hint: string;
  icon: React.ElementType;
  accent: string;
  tint: string;
}[] = [
  {
    mode: "entry",
    label: "Entr\u00e9e",
    hint: "R\u00e9ception de marchandise",
    icon: ArrowDownToLine,
    accent: "text-standard",
    tint: "bg-standard-bg",
  },
  {
    mode: "exit",
    label: "Sortie",
    hint: "Technicien ou erreur de stock",
    icon: ArrowUpFromLine,
    accent: "text-critique",
    tint: "bg-critique-bg",
  },
];

const EXIT_REASON_OPTIONS: {
  reason: ExitReason;
  label: string;
  hint: string;
  icon: React.ElementType;
  accent: string;
  tint: string;
}[] = [
  {
    reason: "technician",
    label: "Sortie technicien",
    hint: "Le stock part chez quelqu'un",
    icon: PackagePlus,
    accent: "text-primary",
    tint: "bg-primary/10",
  },
  {
    reason: "loss",
    label: "Erreur de stock",
    hint: "Casse, perte, écart d'inventaire",
    icon: ArrowUpFromLine,
    accent: "text-attention",
    tint: "bg-attention-bg",
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
  const orgId = useOrganizationStore((s) => s.currentOrganization?.id);

  // ─── Today (recalculates every 60s) ─────────────────────
  const today = useTodayString();
  const [pageLoadTime] = useState(() => new Date().toISOString());

  // ─── Drawer state ───────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);

  // ─── Drawer inner navigation ────────────────────────────
  // Entree : "products" → "detail"
  // Sortie : "reason" → ("technicians") → "products" → "cart"
  type DrawerStep = "reason" | "technicians" | "products" | "detail" | "cart";
  const [drawerStep, setDrawerStep] = useState<DrawerStep>("products");

  // ─── Search ─────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ─── Single product ─────────────────────────────────────
  const [product, setProduct] = useState<ConsoleProduct | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<string>("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const todayDate = useMemo(() => new Date(), []);
  const ninetyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d;
  }, []);
  const [entryDate, setEntryDate] = useState<Date>(todayDate);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  // ─── Destination d'une sortie ───────────────────────────
  const [exitReason, setExitReason] = useState<ExitReason | null>(null);
  const [technicianId, setTechnicianId] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  // ─── Ecran de lancement ────────────────────────────────
  // Une seule fois par chargement de page : les etapes se posent par-dessus
  // l'accueil sans le remonter, revenir en arriere ne le rejoue donc pas.
  const [splashDone, setSplashDone] = useState(false);

  // ─── Historique du jour (tiroir) ───────────────────────
  const [historyOpen, setHistoryOpen] = useState(false);

  // ─── QR Scanner ────────────────────────────────────────
  // Plus de bouton de scan a l'accueil. Deux entrees subsistent : l'appareil
  // photo du telephone (lien ?product=) et le scan par lot pendant une sortie.
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
  // Compteur du pied d'ecran : sans lui, rien n'indique qu'il y a quelque
  // chose derriere le bouton.
  const todayCount = session.length + olderMovements.length;

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

  // Le motif choisi devient le type de mouvement : une seule source de verite,
  // pour que le libelle affiche et la ligne ecrite en base ne divergent jamais.
  const exitMovementType: MovementKind = exitReason === "loss" ? "exit_loss" : "exit_technician";
  // Ou part le stock — sert au chip d'en-tete et au bouton de validation.
  const exitDestination = exitReason === "loss" ? "Erreur de stock" : techFullName;

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
    setInvoiceRef("");
    setEntryDate(todayDate);
    setCart([]);
    setTechnicianId("");
    setExitReason(null);

    // Une sortie demande d'abord ou part le stock : sans cette reponse le
    // mouvement ne peut pas etre qualifie.
    setDrawerStep(mode === "exit" ? "reason" : "products");
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
      setInvoiceRef("");
      setEntryDate(todayDate);
      setCart([]);
      setTechnicianId("");
      setExitReason(null);
    }, 300);
  }, []);

  // ─── Scan action sheet choices ─────────────────────
  const handleScanAction = useCallback(
    (mode: ActionMode) => {
      if (!scannedProduct) return;
      setScanActionSheetOpen(false);

      if (mode === "exit") {
        // Le produit est deja identifie : reste a savoir ou il part.
        setActionMode("exit");
        setSearchQuery("");
        setProduct(null);
        setCart([{ product: scannedProduct, quantity: 1 }]);
        setTechnicianId("");
        setExitReason(null);
        setDrawerStep("reason");
        setDrawerOpen(true);
      } else {
        // Entree — le produit scanne suffit, on saisit directement la quantite
        setActionMode(mode);
        setSearchQuery("");
        setCart([]);
        setTechnicianId("");
        setExitReason(null);
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
        supplier_id: found.supplier_id ?? null,
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

  // ─── Nature de la sortie ──────────────────────────────
  // Une erreur de stock n'est pas un technicien parmi d'autres : c'est une
  // autre nature de mouvement. La poser d'abord evite de la choisir en visant
  // un nom voisin, et laisse la liste des techniciens ne contenir que des
  // techniciens.
  const selectExitReason = useCallback((reason: ExitReason) => {
    navigator.vibrate?.(10);
    setExitReason(reason);
    setTechnicianId("");
    setSearchQuery("");
    setDrawerStep(reason === "technician" ? "technicians" : "products");
  }, []);

  // ─── Choix du technicien ──────────────────────────────
  const selectTechnician = useCallback((techId: string) => {
    navigator.vibrate?.(10);
    setTechnicianId(techId);
    setSearchQuery("");
    setDrawerStep("products");
  }, []);

  // ─── Revenir sur le choix de destination ──────────────
  const clearExitReason = useCallback(() => {
    setExitReason(null);
    setTechnicianId("");
    setCart([]);
    setDrawerStep("reason");
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
    } else if (drawerStep === "detail") {
      setProduct(null);
      setQuantity(1);
      setUnitPrice("");
      setDrawerStep("products");
      setSearchQuery("");
    } else if (drawerStep === "products" && actionMode === "exit") {
      // On remonte d'un seul cran : vers la liste des techniciens si l'on en
      // vient, vers la nature de la sortie sinon.
      if (exitReason === "technician") {
        setTechnicianId("");
        setCart([]);
        setDrawerStep("technicians");
        setSearchQuery("");
      } else {
        clearExitReason();
      }
    } else if (drawerStep === "technicians") {
      clearExitReason();
    }
  }, [drawerStep, actionMode, exitReason, clearExitReason]);

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
          movementType: isEntry ? "entry" : exitMovementType,
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
      setInvoiceRef("");
      setEntryDate(todayDate);

      // Return to product list (rapid-fire mode)
      setProduct(null);
      setDrawerStep("products");
      setSearchQuery("");
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
          supplierId: product.supplier_id ?? undefined,
          unitPrice: parsedPrice || undefined,
          invoiceReference: invoiceRef || undefined,
          entryDate:
            entryDate.toDateString() !== todayDate.toDateString()
              ? entryDate.toISOString()
              : undefined,
        },
        { onSuccess, onError }
      );
    } else {
      createExit.mutate(
        {
          organizationId: orgId,
          productId: product.id,
          quantity,
          type: exitMovementType,
          technicianId: exitReason === "technician" ? technicianId : undefined,
        },
        { onSuccess, onError }
      );
    }
  }, [
    product,
    orgId,
    quantity,
    actionMode,
    isSubmitting,
    createEntry,
    createExit,
    unitPrice,
    invoiceRef,
    entryDate,
    exitMovementType,
    exitReason,
    technicianId,
  ]);

  // ─── Submit batch (exit_technician) ───────────────────
  const handleBatchSubmit = useCallback(async () => {
    if (!orgId || !exitReason || cart.length === 0 || isBatchSubmitting) return;
    // Une sortie technicien sans technicien n'est pas tracable : on refuse.
    if (exitReason === "technician" && !technicianId) return;

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
          type: exitMovementType,
          technicianId: exitReason === "technician" ? technicianId : undefined,
        });
        const stockAfter = item.product.stock_current - item.quantity;
        setSession((prev) => [
          {
            localId: crypto.randomUUID(),
            movementType: exitMovementType,
            productId: item.product.id,
            productName: item.product.name,
            quantity: item.quantity,
            stockAfter,
            technicianName: exitReason === "technician" ? techFullName : undefined,
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
      const s = successCount > 1 ? "s" : "";
      toast.success(
        exitReason === "technician"
          ? `${successCount} produit${s} sorti${s} vers ${techFullName}`
          : `${successCount} produit${s} retiré${s} — erreur de stock`
      );
      setCart([]);
      setSearchQuery("");
      // Drawer stays open for rapid-fire
    }
  }, [
    orgId,
    technicianId,
    cart,
    isBatchSubmitting,
    techFullName,
    createExit,
    exitReason,
    exitMovementType,
  ]);

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
    if (actionMode === "entry") return "Entr\u00e9e";
    if (actionMode !== "exit") return "Action";
    // Tant que la nature n'est pas choisie, l'annoncer serait mentir.
    if (!exitReason) return "Sortie";
    if (drawerStep === "technicians") return "Quel technicien ?";
    return exitReason === "loss" ? "Erreur de stock" : "Sortie technicien";
  }, [actionMode, exitReason, drawerStep]);

  // ─── Pile : peut-on remonter d'un cran ? ──────────────
  const canGoBack =
    drawerStep === "detail" ||
    drawerStep === "cart" ||
    drawerStep === "technicians" ||
    (drawerStep === "products" && actionMode === "exit");

  // ─── Barre d'action de l'etape courante ───────────────
  // Une seule barre a la fois : l'etape decide ce qu'elle propose.
  let stackFooter: React.ReactNode = null;
  if (drawerStep === "detail" && product) {
    stackFooter = (
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
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" /> En cours&hellip;
          </>
        ) : (
          submitLabel
        )}
      </Button>
    );
  } else if (actionMode === "exit" && drawerStep === "cart" && cart.length > 0) {
    stackFooter = (
      <Button
        onClick={handleBatchSubmit}
        disabled={isSubmitting}
        className="w-full h-12 text-[15px] active:scale-[0.97]"
      >
        {isBatchSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" /> En cours&hellip;
          </>
        ) : exitReason === "loss" ? (
          "Valider — erreur de stock"
        ) : (
          `Valider la sortie vers ${techFullName}`
        )}
      </Button>
    );
  } else if (actionMode === "exit" && drawerStep === "products" && cart.length > 0) {
    stackFooter = (
      <Button
        onClick={() => setDrawerStep("cart")}
        className="w-full h-12 text-[15px] active:scale-[0.97]"
      >
        <Package className="size-4" />
        Voir le panier ({cart.length} produit{cart.length > 1 ? "s" : ""} &middot; {cartTotalItems}{" "}
        unités)
      </Button>
    );
  }

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════
  return (
    <div>
      {!splashDone && <MobileSplash onDone={() => setSplashDone(true)} />}

      {/* ═══ ETAPE 1 — le seul ecran d'accueil ═══
          Deux choix, rien d'autre. Le scan et l'historique existent toujours
          mais en pied d'ecran : ce sont des outils, pas des decisions, et les
          melanger aux deux cartes ferait quatre choix au lieu de deux. */}
      {/* Hauteur exacte, pas une estimation : 3rem de barre du haut et les 2rem
          de padding du layout. Une valeur approchee laissait du vide en bas et
          l'historique flottait au milieu de nulle part. */}
      <div
        className="flex flex-col gap-3"
        style={{ height: "calc(100dvh - 5rem - env(safe-area-inset-bottom))" }}
      >
        <div className="flex-1 min-h-0 flex flex-col gap-3">
          {ACTION_OPTIONS.map(({ mode, label, hint, icon: Icon, accent, tint }, i) => (
            <motion.button
              key={mode}
              onClick={() => openDrawer(mode)}
              // Les cartes se posent apres le lancement, dans l'ordre de
              // lecture. Sans rebond : rien ne les a lancees.
              initial={{ opacity: 0, y: 16 }}
              animate={splashDone ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              transition={{ type: "spring", bounce: 0, duration: 0.45, delay: i * 0.07 }}
              className="w-full flex-1 min-h-0 flex flex-col items-center justify-center gap-3 rounded-3xl border bg-white dark:bg-card px-5 active:scale-[0.98] transition-transform"
            >
              <span
                className={cn(
                  "size-20 rounded-2xl flex items-center justify-center shrink-0",
                  tint
                )}
              >
                <Icon className={cn("size-10", accent)} />
              </span>
              <span className="text-center">
                <span className="block font-heading font-semibold text-[26px] leading-none">
                  {label}
                </span>
                <span className="block text-[13px] text-muted-foreground leading-tight mt-1.5">
                  {hint}
                </span>
              </span>
            </motion.button>
          ))}
        </div>

        {/* Pied d'ecran : l'historique seul, colle en bas. La zone sure est
            deja retiree de la hauteur du conteneur. */}
        <div className="shrink-0">
          <button
            onClick={() => setHistoryOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border bg-white dark:bg-card py-3.5 active:scale-[0.97] transition-transform"
          >
            <Clock className="size-[18px] text-muted-foreground" />
            <span className="font-semibold text-[14px]">
              Historique
              {todayCount > 0 && (
                <span className="text-muted-foreground font-normal"> · {todayCount}</span>
              )}
            </span>
          </button>
        </div>
      </div>

      {/* ═══ HISTORIQUE DU JOUR (tiroir) ═══ */}
      <Drawer open={historyOpen} onOpenChange={setHistoryOpen}>
        <DrawerContent className="max-h-[85vh] flex flex-col">
          <DrawerTitle className="px-4 pt-3 pb-2 font-heading text-base font-semibold shrink-0">
            Historique du jour
          </DrawerTitle>
          <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {session.length === 0 && olderMovements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
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
                  <>
                    <Clock className="size-10 text-muted-foreground/20 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Aucun mouvement aujourd&apos;hui.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <ul className="space-y-1.5">
                {/* Session entries (current session, with undo) */}
                {session.map((entry) => {
                  const isEntry = isPositiveMovement(entry.movementType);
                  const reverting = revertingIds.has(entry.localId);
                  const time = new Date(entry.createdAt).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <li
                      key={entry.localId}
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
                            {MOVEMENT_TYPE_LABELS[entry.movementType]}
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
                    </li>
                  );
                })}

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
                  const isEntry = isPositiveMovement(m.movement_type);
                  const time = m.created_at
                    ? new Date(m.created_at).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";
                  const techName = m.technician
                    ? `${m.technician.first_name} ${m.technician.last_name}`
                    : undefined;
                  const typeLabel = MOVEMENT_TYPE_LABELS[m.movement_type] ?? m.movement_type;
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
        </DrawerContent>
      </Drawer>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* PILE D'ECRANS (etapes)                                 */}
      {/* ═══════════════════════════════════════════════════════ */}
      <MobileStackScreen
        open={drawerOpen && !batchScanOpen}
        title={drawerTitle}
        subtitle={
          // Pas avant que la destination soit reellement connue : sur l'ecran
          // de choix du technicien, exitDestination est encore vide.
          actionMode === "exit" && drawerStep !== "reason" && drawerStep !== "technicians"
            ? exitDestination || undefined
            : undefined
        }
        onBack={canGoBack ? drawerGoBack : undefined}
        onClose={closeDrawer}
        footer={stackFooter}
      >
        <div className="flex flex-col h-full">
          {/* ── En-tete d'etape ── */}
          <div className="px-4 pt-3 pb-2 shrink-0">
            {/* Le scan par lot reste accessible pendant le choix des produits */}
            {actionMode === "exit" && drawerStep === "products" && exitReason && (
              <div className="mb-2 flex items-center justify-end">
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
                      : exitDestination
                        ? `Ajouter un produit \u2014 ${exitDestination}\u2026`
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
            {/* ═══ NATURE DE LA SORTIE (etape 2) ═══
                Deux cartes, comme a l'accueil : un choix binaire se presente
                partout de la meme facon dans cette application. */}
            {drawerStep === "reason" && (
              <div className="flex flex-col gap-3 pt-2">
                {EXIT_REASON_OPTIONS.map(({ reason, label, hint, icon: Icon, accent, tint }) => (
                  <button
                    key={reason}
                    onClick={() => selectExitReason(reason)}
                    className="w-full flex items-center gap-4 rounded-2xl border bg-white dark:bg-card px-4 py-5 text-left active:scale-[0.98] transition-transform"
                  >
                    <span
                      className={cn(
                        "size-14 rounded-2xl flex items-center justify-center shrink-0",
                        tint
                      )}
                    >
                      <Icon className={cn("size-7", accent)} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-heading font-semibold text-[19px] leading-tight">
                        {label}
                      </span>
                      <span className="block text-[13px] text-muted-foreground leading-tight mt-0.5">
                        {hint}
                      </span>
                    </span>
                    <ChevronLeft className="size-4 shrink-0 rotate-180 text-muted-foreground/40" />
                  </button>
                ))}
              </div>
            )}

            {/* ═══ CHOIX DU TECHNICIEN (etape 3) ═══ */}
            {drawerStep === "technicians" && (
              <div className="pt-1">
                {filteredTechnicians.length > 0 ? (
                  <InsetGroup>
                    {filteredTechnicians.map((t) => (
                      <InsetRow
                        key={t.id}
                        onClick={() => selectTechnician(t.id)}
                        title={`${t.first_name} ${t.last_name}`}
                        leading={
                          <span className="size-9 rounded-full bg-muted flex items-center justify-center font-semibold shrink-0 text-xs">
                            {t.first_name[0]}
                            {t.last_name[0]}
                          </span>
                        }
                      />
                    ))}
                  </InsetGroup>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <PackagePlus className="size-10 text-muted-foreground/20 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {debouncedSearch ? "Aucun technicien trouvé." : "Aucun technicien."}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ═══ PRODUCT LIST ═══ */}
            {drawerStep === "products" && (
              <div className="space-y-2 pt-1">
                {isSearching && debouncedSearch ? (
                  <div className="grid grid-cols-2 gap-2.5 py-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="rounded-xl border p-2 space-y-2">
                        <Skeleton className="w-full aspect-square rounded-lg" />
                        <Skeleton className="h-3.5 w-3/4" />
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-5 w-8" />
                          <Skeleton className="h-5 w-12 rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : sortedProducts.length > 0 ? (
                  <ul className="grid grid-cols-2 gap-2.5">
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
                        icon_name: p.icon_name,
                        icon_color: p.icon_color,
                        image_url: p.image_url,
                        supplier_id: p.supplier_id,
                        supplier_name: p.supplier?.name ?? null,
                      };
                      return (
                        <li key={p.id}>
                          <button
                            onClick={() =>
                              actionMode === "exit"
                                ? toggleProductInCart(consoleP)
                                : selectProductSingle(consoleP)
                            }
                            className={cn(
                              "w-full rounded-xl border p-2 flex flex-col gap-2 text-left transition-all active:scale-[0.98]",
                              inCart && "bg-primary/5 ring-2 ring-primary/40 border-primary/30",
                              !inCart && status === "critique" && "border-critique/30",
                              !inCart && status === "attention" && "border-attention/30"
                            )}
                          >
                            {/* Large photo — primary visual anchor on mobile */}
                            <div className="relative w-full">
                              <ProductIconDisplay
                                iconName={p.icon_name}
                                iconColor={p.icon_color}
                                imageUrl={p.image_url}
                                size="xl"
                                className="w-full"
                              />
                              {actionMode === "exit" && inCart && (
                                <div className="absolute top-1.5 right-1.5 size-6 rounded-full bg-primary flex items-center justify-center shadow">
                                  <Check className="size-3.5 text-primary-foreground" />
                                </div>
                              )}
                            </div>

                            {/* Name */}
                            <p className="text-[13px] font-medium leading-tight line-clamp-2 min-h-[2.2em]">
                              {p.name}
                            </p>

                            {/* Stock + state */}
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className={cn(
                                  "font-heading font-bold tabular-nums text-lg leading-none",
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
              </div>
            )}

            {/* ═══ PRODUCT DETAIL (entry / exit_anonymous) ═══ */}
            {drawerStep === "detail" && product && (
              <div className="space-y-5 pt-1">
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
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <ProductIconDisplay
                          iconName={product.icon_name}
                          iconColor={product.icon_color}
                          imageUrl={product.image_url}
                          size="lg"
                          className="shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <h2 className="font-heading text-[17px] font-semibold leading-tight">
                            {product.name}
                          </h2>
                          {product.sku && (
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">
                              {product.sku}
                            </p>
                          )}
                          {isEntry && (
                            <p className="text-xs mt-1">
                              <span className="text-muted-foreground">Fournisseur : </span>
                              {product.supplier_name ? (
                                <span className="font-medium">{product.supplier_name}</span>
                              ) : (
                                <span className="text-attention font-medium">aucun</span>
                              )}
                            </p>
                          )}
                        </div>
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
                    className="flex-1 h-12 text-2xl font-heading font-bold tabular-nums text-center rounded-xl bg-white dark:bg-card [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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

                {/* Entry-only fields: price, invoice ref, date */}
                {actionMode === "entry" && (
                  <div className="space-y-3">
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        placeholder="Prix HT"
                        value={unitPrice}
                        onChange={(e) => setUnitPrice(e.target.value)}
                        className="w-full h-11 text-[15px] rounded-xl bg-white dark:bg-card pr-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                        {"\u20AC"}
                      </span>
                    </div>
                    <Input
                      type="text"
                      placeholder="Réf. facture (optionnel)"
                      value={invoiceRef}
                      onChange={(e) => setInvoiceRef(e.target.value)}
                      className="w-full h-11 text-[15px] rounded-xl bg-white dark:bg-card"
                    />
                    <DatePicker
                      value={entryDate}
                      onChange={(d) => setEntryDate(d ?? todayDate)}
                      disabled={{ after: todayDate, before: ninetyDaysAgo }}
                      placeholder="Date d'entrée"
                      className="w-full h-11 text-[15px] rounded-xl bg-white dark:bg-card"
                      popoverClassName="z-[60]"
                    />
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
              </div>
            )}

            {/* ═══ CART REVIEW (exit_technician, step 3) ═══ */}
            {drawerStep === "cart" && (
              <div className="space-y-4 pt-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {cart.length} produit{cart.length > 1 ? "s" : ""} &middot; {cartTotalItems} unit
                    {"\u00E9"}s
                  </p>
                  <button
                    onClick={() => {
                      setDrawerStep("products");
                      setSearchQuery("");
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
                      <ProductIconDisplay
                        iconName={item.product.icon_name}
                        iconColor={item.product.icon_color}
                        imageUrl={item.product.image_url}
                        size="md"
                        className="shrink-0"
                      />
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
              </div>
            )}
          </div>
        </div>
      </MobileStackScreen>

      {/* ── QR Scanner Modal (batch — tech mode) ── */}
      <QrScannerModal
        open={batchScanOpen}
        onClose={() => {
          setBatchScanOpen(false);
          // Wait for scanner to fully unmount, then reopen drawer on cart
          if (cart.length > 0) {
            setTimeout(() => {
              setDrawerStep("cart");
              setDrawerOpen(true);
            }, 150);
          }
        }}
        onScan={handleBatchScan}
        continuous
        title={`Scanner pour ${exitDestination}`}
        bottomContent={
          cart.length > 0 ? (
            <button
              onClick={() => setBatchScanOpen(false)}
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
                {ACTION_OPTIONS.map(({ mode, label, hint, icon: ActionIcon, accent }) => (
                  <button
                    key={mode}
                    onClick={() => handleScanAction(mode)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 min-h-[48px] text-left active:bg-muted/60 transition-colors"
                  >
                    <ActionIcon className={cn("size-[18px] shrink-0", accent)} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-[15px] leading-tight">{label}</span>
                      <span className="block text-[12px] text-muted-foreground leading-tight">
                        {hint}
                      </span>
                    </span>
                    <ChevronLeft className="size-4 text-muted-foreground/40 shrink-0 rotate-180" />
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
