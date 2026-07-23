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
  PackagePlus,
  Check,
  Clock,
  ScanLine,
  Wrench,
  Car,
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
import { useProducts, useTechnicians, useStockMovements, useVehicles } from "@/hooks/queries";
import { useCreateStockEntry, useCreateStockExit, useAssignEquipment } from "@/hooks/mutations";
import { calculateStockScore, getStockBadgeVariant } from "@/lib/utils/stock";
import { maxSingleOrgStock, pickExitSource, type OrgStock } from "@/lib/utils/exit-source";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounce";
import {
  MobileStackScreen,
  InsetGroup,
  InsetRow,
  InsetField,
  SwipeToActionRow,
} from "./mobile-stack-screen";
import { MobileSplash, shouldShowSplash } from "./mobile-splash";
import { organizationLogo } from "@/lib/utils/org-logo";
import {
  MobileHistorySheet,
  movementToHistoryEntry,
  type HistoryEntry,
} from "./mobile-history-sheet";
import { MobileVehicleSheet } from "./mobile-vehicle-sheet";
import { MobileVehicleInspection } from "./mobile-vehicle-inspection";
import type { VehicleWithTechnician } from "@/lib/supabase/queries/vehicles";

const QrScannerModal = dynamic(() => import("@/components/qr-scanner-modal"), { ssr: false });

// ─── Types ──────────────────────────────────────────────────
// L'ecran d'accueil ne pose qu'une question : ca rentre ou ca sort.
// Le motif d'une sortie (technicien ou erreur de stock) se choisit ensuite ;
// c'est lui qui determine le type de mouvement enregistre.
type ActionMode = "entry" | "exit";
type ExitReason = "technician" | "loss";
type MovementKind = "entry" | "exit_technician" | "exit_anonymous" | "exit_loss";
// Ce qui bouge : un consommable du stock, ou un outil. Meme table
// (`product_type`), mais deux natures : l'outil se prete a un technicien
// (affectation, retour possible) la ou le consommable, lui, se consomme.
type ItemKind = "product" | "equipment";

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
  /**
   * Ce que detiennent les autres societes.
   *
   * Non actionnable dans le mouvement en cours — une sortie SEIREN ne peut pas
   * puiser chez SMPR — mais utile a l'ecran de quantite : quand le stock local
   * est court, savoir qu'il y en a ailleurs oriente vers un transfert plutot
   * qu'une commande.
   */
  other_org_stock?: { name: string; stock: number }[];
  /**
   * Ce que detient chaque societe, sans interpretation.
   *
   * C'est de la que se deduit, en sortie, la societe debitee : celle qui en a
   * le moins. Le calcul depend de la quantite demandee, qui change encore a
   * l'ecran suivant — on transporte donc la matiere brute plutot qu'un choix
   * fige au moment ou le produit a ete touche.
   */
  org_stock?: OrgStock[];
}

interface CartItem {
  product: ConsoleProduct;
  quantity: number;
}

/**
 * Plus grande quantite sortable en une fois.
 *
 * Le cumul des deux societes ne fait pas une quantite sortable : une sortie
 * vient d'une seule societe. Le plafond est donc le stock de la mieux fournie.
 * L'outillage, qui n'a pas de ventilation par societe, garde son stock global.
 */
function exitCeiling(p: ConsoleProduct): number {
  return p.org_stock && p.org_stock.length > 0 ? maxSingleOrgStock(p.org_stock) : p.stock_current;
}

interface SessionEntry {
  localId: string;
  movementType: MovementKind;
  /**
   * Societe dans laquelle le mouvement a ete ecrit.
   *
   * Une entree peut viser une autre societe que la societe courante :
   * l'annulation doit revenir sur celle-la, sinon elle sortirait du stock
   * d'une societe qui n'a jamais rien recu.
   */
  organizationId: string;
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
    // « Sortie » est deja dans la barre de navigation : le repeter mangerait
    // la largeur sans rien apprendre.
    label: "Technicien",
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

// Choix « Produit ou Outil », pose apres la societe (entree) ou en tete
// (sortie). Memes cartes que les autres choix binaires de l'ecran : rien ne
// doit signaler qu'on repond a une question d'une autre nature.
const ITEM_KIND_OPTIONS: {
  kind: ItemKind;
  label: string;
  hint: string;
  icon: React.ElementType;
  accent: string;
  tint: string;
}[] = [
  {
    kind: "product",
    label: "Produit",
    hint: "Consommable du stock",
    icon: Package,
    accent: "text-primary",
    tint: "bg-primary/10",
  },
  {
    kind: "equipment",
    label: "Outil",
    hint: "Matériel prêté aux techniciens",
    icon: Wrench,
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
  const organizations = useOrganizationStore((s) => s.organizations);

  // ─── Societe qui recoit l'entree ───────────────────────
  // Le catalogue est commun ; ce choix dit seulement a qui le stock est
  // affecte. Il se pose avant la liste plutot que sur chaque fiche : une
  // livraison arrive pour une societe, on enchaine ensuite les produits.
  // Le redemander a chaque article multiplierait les occasions de se
  // tromper sur la seule information qui ne se voit pas apres coup.
  const [entryOrgId, setEntryOrgId] = useState<string | undefined>(orgId);
  const entryOrg = useMemo(
    () => organizations.find((o) => o.id === entryOrgId),
    [organizations, entryOrgId]
  );
  const multiOrg = organizations.length > 1;

  // ─── Today (recalculates every 60s) ─────────────────────
  const today = useTodayString();
  const [pageLoadTime] = useState(() => new Date().toISOString());

  // ─── Drawer state ───────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);

  // ─── Drawer inner navigation ────────────────────────────
  // Entree : ("organization") → "kind" → "products" → "detail"
  // Sortie : "kind" → "reason" → ("technicians") → "products" → "cart"
  type DrawerStep =
    | "organization"
    | "kind"
    | "reason"
    | "technicians"
    | "products"
    | "detail"
    | "cart";
  const [drawerStep, setDrawerStep] = useState<DrawerStep>("products");

  // ─── Produit ou outil ───────────────────────────────────
  // Decide quelle liste s'affiche et comment la sortie s'ecrit : un outil
  // remis a un technicien est une affectation (il le detient), pas une
  // consommation.
  const [itemKind, setItemKind] = useState<ItemKind | null>(null);
  const onlyEquipment = itemKind === "equipment";
  const itemNoun = itemKind === "equipment" ? "outil" : "produit";

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
  // ─── Motif d'une erreur de stock ────────────────────────
  // Une perte n'est jamais anodine : casse, vol, oubli. Sans le motif, le
  // journal ne dit que « -1 » sans dire pourquoi le stock a fondu. Obligatoire
  // avant de valider une erreur de stock (outil comme consommable).
  const [lossNote, setLossNote] = useState("");

  // ─── Ecran de lancement ────────────────────────────────
  // Rejoue au plus une fois par quart d'heure. Les etapes se posant par-dessus
  // l'accueil sans le remonter, revenir en arriere ne le declenche pas non
  // plus. La decision est prise a l'initialisation : la calculer plus tard
  // ferait apparaitre le logo apres coup, en plein ecran deja affiche.
  const [splashDone, setSplashDone] = useState(() => !shouldShowSplash());

  // ─── Historique du jour (tiroir) ───────────────────────
  const [historyOpen, setHistoryOpen] = useState(false);

  // ─── Vehicules (tiroir) ─────────────────────────────────
  // La liste des vehicules, puis l'etat des lieux du vehicule choisi.
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [inspectionVehicle, setInspectionVehicle] = useState<VehicleWithTechnician | null>(null);

  // ─── QR Scanner ────────────────────────────────────────
  // Le scan vit dans l'etape produits, la ou l'on designe ce qui bouge — pas
  // a l'accueil, ou l'on n'a pas encore dit si ca rentre ou si ca sort.
  const [batchScanOpen, setBatchScanOpen] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<ConsoleProduct | null>(null);
  const [scanActionSheetOpen, setScanActionSheetOpen] = useState(false);

  // ─── Session journal ────────────────────────────────────
  const [session, setSession] = useState<SessionEntry[]>([]);
  const [revertingIds, setRevertingIds] = useState<Set<string>>(new Set());
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);

  // ─── Data ───────────────────────────────────────────────
  // Le catalogue est commun aux societes ; `organizationId` designe celle dont
  // le stock est affiche. Une entree montre donc le stock de la societe qui va
  // recevoir la marchandise, une sortie celui de la societe courante — c'est
  // dans celle-la qu'on puise.
  const stockOrgId = actionMode === "entry" ? (entryOrgId ?? orgId) : orgId;

  // Une sortie n'est plus rattachee a la societe affichee : elle puise chez
  // celle qui en a le moins, produit par produit. Le stock montre dans la liste
  // est donc le cumul — filtrer sur une societe masquerait des produits
  // parfaitement sortables, et afficherait « rupture » sur un produit dont
  // l'autre societe detient douze unites.
  const stockScope = actionMode === "exit" ? "all" : "organization";

  const { data: productsResult, isLoading: isSearching } = useProducts({
    organizationId: stockOrgId,
    stockScope,
    search: debouncedSearch || undefined,
    onlyEquipment,
  });
  // Full product list (no search filter) — used for QR scan lookup
  const { data: allProductsResult } = useProducts({
    organizationId: stockOrgId,
    stockScope,
    onlyEquipment,
  });
  const allProducts = useMemo(() => allProductsResult?.products ?? [], [allProductsResult]);

  const { data: techniciansData = [] } = useTechnicians(orgId);
  const { data: vehicles = [], isLoading: isLoadingVehicles } = useVehicles(orgId);
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

  // ─── Lignes d'historique ───────────────────────────────
  // Deux origines, une seule forme : ce que l'on vient d'enregistrer (encore
  // annulable) et ce qui existait avant l'ouverture de la page.
  const sessionEntries: HistoryEntry[] = useMemo(
    () =>
      session.map((e) => ({
        key: e.localId,
        movementType: e.movementType,
        productName: e.productName,
        quantity: e.quantity,
        who: e.technicianName,
        at: e.createdAt,
        undoable: true,
      })),
    [session]
  );
  const olderEntries: HistoryEntry[] = useMemo(
    () => olderMovements.map(movementToHistoryEntry),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todayResult, pageLoadTime]
  );

  // Ventilation chez les autres societes, deja chargee avec le produit :
  // aucune requete supplementaire.
  const otherOrgStock = useCallback(
    (pos?: { organization_id: string; stock_current: number }[] | null) =>
      (pos ?? [])
        .filter((x) => x.organization_id !== stockOrgId && x.stock_current > 0)
        .map((x) => ({
          name: organizations.find((o) => o.id === x.organization_id)?.name ?? "Autre",
          stock: x.stock_current,
        })),
    [stockOrgId, organizations]
  );

  // Ventilation nommee, limitee aux societes de l'application : la base garde
  // des lignes d'organisations de test qui n'apparaissent nulle part ailleurs,
  // et elles ne doivent pas pouvoir etre designees comme source d'une sortie.
  const orgStockOf = useCallback(
    (pos?: { organization_id: string; stock_current: number }[] | null): OrgStock[] =>
      organizations.flatMap((org) => {
        const row = (pos ?? []).find((x) => x.organization_id === org.id);
        return row ? [{ id: org.id, name: org.name, stock: row.stock_current }] : [];
      }),
    [organizations]
  );

  /**
   * Societe debitee par une sortie.
   *
   * L'outillage n'a pas de ventilation par societe (elle a ete supprimee : il
   * se suit globalement). Sans ligne a comparer, la regle du « moins fourni »
   * n'a pas de sens et l'on retombe sur la societe courante, comme avant.
   */
  const exitSourceFor = useCallback(
    (p: ConsoleProduct, qty: number) => {
      const picked = pickExitSource(p.org_stock ?? [], qty);
      if (picked) return picked;
      const fallback = organizations.find((o) => o.id === orgId);
      return fallback ? { id: fallback.id, name: fallback.name, stock: p.stock_current } : null;
    },
    [organizations, orgId]
  );

  // ─── Mutations ─────────────────────────────────────────
  const createEntry = useCreateStockEntry();
  const createExit = useCreateStockExit();
  const assignEquip = useAssignEquipment();
  const isSubmitting =
    createEntry.isPending || createExit.isPending || assignEquip.isPending || isBatchSubmitting;

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
  const openDrawer = useCallback(
    (mode: ActionMode) => {
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
      setLossNote("");
      setItemKind(null);

      if (mode === "exit") {
        // Une sortie commence par « produit ou outil » : la nature decide de
        // tout le reste (une sortie d'outil vers un technicien est une
        // affectation, pas une consommation).
        setDrawerStep("kind");
      } else if (multiOrg) {
        // Entree : d'abord la societe qui recoit. Une seule societe : l'ecran
        // n'offrirait aucun choix, ce serait un appui a payer pour rien.
        setEntryOrgId(undefined);
        setDrawerStep("organization");
      } else {
        setEntryOrgId(orgId);
        setDrawerStep("kind");
      }
      setDrawerOpen(true);
    },
    [multiOrg, orgId, todayDate]
  );

  // ─── Choix de la societe qui recoit l'entree ──────────
  const selectEntryOrg = useCallback((id: string) => {
    navigator.vibrate?.(10);
    setEntryOrgId(id);
    setSearchQuery("");
    setDrawerStep("kind");
  }, []);

  // ─── Produit ou outil ─────────────────────────────────
  // En entree, on enchaine sur la liste. En sortie, il reste a dire ou part le
  // stock (technicien ou erreur) : la nature choisie ici en change le sens.
  const selectItemKind = useCallback(
    (kind: ItemKind) => {
      navigator.vibrate?.(10);
      setItemKind(kind);
      setSearchQuery("");
      setDrawerStep(actionMode === "exit" ? "reason" : "products");
    },
    [actionMode]
  );

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
      setLossNote("");
      setItemKind(null);
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
        // Sans la ventilation, un produit scanne ne saurait pas de quelle
        // societe il sort : il retomberait sur la societe courante alors que
        // le meme produit choisi dans la liste partirait de l'autre.
        org_stock: orgStockOf(found.product_organization_stock),
      };
      // Add to cart or increment qty
      setCart((prev) => {
        const existing = prev.find((item) => item.product.id === consoleP.id);
        if (existing) {
          return prev.map((item) =>
            item.product.id === consoleP.id
              ? { ...item, quantity: Math.min(item.quantity + 1, exitCeiling(item.product)) }
              : item
          );
        }
        return [...prev, { product: consoleP, quantity: 1 }];
      });
      toast.success(found.name, { description: "Ajout\u00e9 au panier" });
    },
    [allProducts, orgStockOf]
  );

  // \u2500\u2500\u2500 Scan en entree \u2014 un produit a la fois \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // Une entree se saisit produit par produit : chacune porte son prix, sa
  // date et sa facture. Enchainer les scans comme en sortie ferait perdre
  // ces informations.
  const handleEntryScan = useCallback(
    (productId: string) => {
      const found = allProducts.find((p) => p.id === productId);
      if (!found) {
        toast.error("Produit non reconnu");
        return;
      }
      setBatchScanOpen(false);
      navigator.vibrate?.(10);
      const consoleP: ConsoleProduct = {
        id: found.id,
        name: found.name,
        sku: found.sku,
        stock_current: found.stock_current ?? 0,
        stock_min: found.stock_min,
        price: found.price ?? null,
        icon_name: found.icon_name,
        icon_color: found.icon_color,
        image_url: found.image_url,
        supplier_id: found.supplier_id ?? null,
        supplier_name: found.supplier?.name ?? null,
        other_org_stock: otherOrgStock(found.product_organization_stock),
        org_stock: orgStockOf(found.product_organization_stock),
      };
      setProduct(consoleP);
      setQuantity(1);
      setUnitPrice(consoleP.price != null ? consoleP.price.toString() : "");
      setSearchQuery("");
      setDrawerStep("detail");
    },
    [allProducts, otherOrgStock, orgStockOf]
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
    setLossNote("");
    setDrawerStep("reason");
    setSearchQuery("");
  }, []);

  // ─── Cart actions ─────────────────────────────────────
  const updateCartQty = useCallback((productId: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const newQty = Math.max(1, Math.min(item.quantity + delta, exitCeiling(item.product)));
        return { ...item, quantity: newQty };
      })
    );
  }, []);

  const setCartQty = useCallback((productId: string, qty: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        const newQty = Math.max(1, Math.min(qty, exitCeiling(item.product)));
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
    } else if (drawerStep === "products") {
      if (actionMode === "exit") {
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
      } else {
        // Entree : la liste vient du choix « produit ou outil ».
        setItemKind(null);
        setDrawerStep("kind");
        setSearchQuery("");
      }
    } else if (drawerStep === "technicians") {
      clearExitReason();
    } else if (drawerStep === "reason") {
      // La nature de la sortie decoule du choix « produit ou outil ».
      setItemKind(null);
      setDrawerStep("kind");
      setSearchQuery("");
    } else if (drawerStep === "kind" && actionMode === "entry" && multiOrg) {
      setItemKind(null);
      setEntryOrgId(undefined);
      setDrawerStep("organization");
      setSearchQuery("");
    }
  }, [drawerStep, actionMode, exitReason, clearExitReason, multiOrg]);

  // ─── Submit single (entry / exit_anonymous) ───────────
  const handleSubmit = useCallback(() => {
    if (!product || isSubmitting || !actionMode) return;
    if (quantity < 1) return;

    const isEntry = actionMode === "entry";
    // Une entree va dans la societe choisie a l'etape precedente. Une sortie
    // puise chez celle qui en a le moins — le choix se refait ici avec la
    // quantite finale, qui a pu changer depuis l'ouverture de l'ecran.
    const source = isEntry ? null : exitSourceFor(product, quantity);
    const writeOrgId = isEntry ? entryOrgId : source?.id;
    if (!writeOrgId) {
      if (!isEntry) toast.error(`Aucun stock disponible pour ${product.name}`);
      return;
    }

    if (!isEntry && source && quantity > source.stock) {
      toast.error(`Stock insuffisant chez ${source.name} — disponible : ${source.stock}`);
      return;
    }

    // Le stock annonce apres coup est celui de la societe debitee, pas le
    // cumul : c'est lui qui a bouge.
    const sourceStock = source?.stock ?? product.stock_current;
    const stockAfter = isEntry ? product.stock_current + quantity : sourceStock - quantity;
    const localId = crypto.randomUUID();

    const onSuccess = () => {
      navigator.vibrate?.(10);
      setProduct((prev) => {
        if (!prev) return prev;
        // En sortie, `stock_current` porte le cumul : il baisse de la quantite
        // sortie, tandis que `stockAfter` ne concerne que la societe debitee.
        const nextTotal = isEntry ? stockAfter : prev.stock_current - quantity;
        return {
          ...prev,
          stock_current: nextTotal,
          org_stock: prev.org_stock?.map((o) =>
            o.id === writeOrgId
              ? { ...o, stock: isEntry ? o.stock + quantity : o.stock - quantity }
              : o
          ),
        };
      });
      setSession((prev) => [
        {
          localId,
          movementType: isEntry ? "entry" : exitMovementType,
          organizationId: writeOrgId,
          productId: product.id,
          productName: product.name,
          quantity,
          stockAfter,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      const sign = isEntry ? "+" : "-";
      // La societe est nommee en sortie : l'utilisateur ne l'a pas choisie,
      // c'est la regle qui l'a designee. Ne pas la dire laisserait un doute
      // sur le stock qui vient de bouger.
      toast.success(
        source
          ? `${sign}${quantity} ${product.name} — ${source.name} : ${stockAfter} en stock`
          : `${sign}${quantity} ${product.name} - ${stockAfter} en stock`
      );
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
          organizationId: writeOrgId,
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
          organizationId: writeOrgId,
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
    exitSourceFor,
    // Sans cette dependance, une entree validee apres un changement de
    // societe serait ecrite dans la precedente.
    entryOrgId,
  ]);

  // ─── Submit batch (exit_technician) ───────────────────
  const handleBatchSubmit = useCallback(async () => {
    if (!orgId || !exitReason || cart.length === 0 || isBatchSubmitting) return;
    // Une sortie technicien sans technicien n'est pas tracable : on refuse.
    if (exitReason === "technician" && !technicianId) return;
    // Une erreur de stock sans motif ne dit pas pourquoi le stock a fondu : on
    // refuse aussi. Le bouton est deja desactive, ceci est la ceinture.
    if (exitReason === "loss" && !lossNote.trim()) {
      toast.error("Indiquez le motif de l'erreur de stock");
      return;
    }

    // La societe se decide ligne par ligne : dans un meme panier, un produit
    // peut venir de SMPR et le suivant de SEIREN. Le controle passe donc par
    // la source retenue, pas par le cumul — lequel laisserait valider dix
    // unites reparties six et quatre, qu'aucune societe ne peut fournir.
    const sources = new Map<string, { id: string; name: string; stock: number }>();
    for (const item of cart) {
      const source = exitSourceFor(item.product, item.quantity);
      if (!source) {
        toast.error(`Aucun stock disponible pour ${item.product.name}`);
        return;
      }
      if (item.quantity > source.stock) {
        toast.error(`${item.product.name} : ${source.name} n'en a que ${source.stock}`);
        return;
      }
      sources.set(item.product.id, source);
    }

    setIsBatchSubmitting(true);

    // Un outil remis a un technicien n'est pas consomme : il lui est affecte
    // (il le detient, retour possible). C'est un autre mouvement — une
    // affectation, pas une sortie.
    const isEquipAssign = itemKind === "equipment" && exitReason === "technician";

    let successCount = 0;
    for (const item of cart) {
      const source = sources.get(item.product.id)!;
      try {
        if (isEquipAssign) {
          await assignEquip.mutateAsync({
            organizationId: source.id,
            productId: item.product.id,
            technicianId,
            quantity: item.quantity,
          });
          // Volontairement pas de ligne annulable : une affectation se defait
          // par un retour d'outil (page Outillage), pas par l'annulation d'une
          // sortie de stock.
        } else {
          await createExit.mutateAsync({
            organizationId: source.id,
            productId: item.product.id,
            quantity: item.quantity,
            type: exitMovementType,
            technicianId: exitReason === "technician" ? technicianId : undefined,
            // Le motif accompagne chaque ligne de perte : le journal dira
            // « -2 — casse » et non « -2 » tout court.
            note: exitReason === "loss" ? lossNote.trim() : undefined,
          });
          const stockAfter = source.stock - item.quantity;
          setSession((prev) => [
            {
              localId: crypto.randomUUID(),
              movementType: exitMovementType,
              organizationId: source.id,
              productId: item.product.id,
              productName: item.product.name,
              quantity: item.quantity,
              stockAfter,
              technicianName: exitReason === "technician" ? techFullName : undefined,
              createdAt: new Date().toISOString(),
            },
            ...prev,
          ]);
        }
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
      const noun = itemKind === "equipment" ? "outil" : "produit";
      toast.success(
        exitReason === "technician"
          ? isEquipAssign
            ? `${successCount} ${noun}${s} affecté${s} à ${techFullName}`
            : `${successCount} ${noun}${s} sorti${s} vers ${techFullName}`
          : `${successCount} ${noun}${s} retiré${s} — erreur de stock`
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
    assignEquip,
    itemKind,
    exitReason,
    exitMovementType,
    exitSourceFor,
    lossNote,
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
            organizationId: entry.organizationId,
            productId: entry.productId,
            quantity: entry.quantity,
            type: "exit_anonymous",
          },
          { onSuccess, onError }
        );
      } else {
        createEntry.mutate(
          {
            organizationId: entry.organizationId,
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

  // La societe recue accompagne toute l'entree : c'est elle qui recevra le
  // stock et portera l'achat. Une fois la nature choisie, on l'ajoute :
  // « SMPR · Outils » dit d'un coup d'oeil ou l'on est.
  const kindLabel =
    itemKind === "equipment" ? "Outils" : itemKind === "product" ? "Produits" : undefined;
  const stackSubtitleEntry =
    drawerStep === "organization"
      ? undefined
      : [entryOrg?.name, kindLabel].filter(Boolean).join(" · ") || undefined;

  // ─── Pile : peut-on remonter d'un cran ? ──────────────
  const canGoBack =
    drawerStep === "detail" ||
    drawerStep === "cart" ||
    drawerStep === "technicians" ||
    drawerStep === "reason" ||
    drawerStep === "products" ||
    (drawerStep === "kind" && actionMode === "entry" && multiOrg);

  // ─── Barre d'action de l'etape courante ───────────────
  // Une seule barre a la fois : l'etape decide ce qu'elle propose.
  let stackFooter: React.ReactNode = null;
  if (drawerStep === "detail" && product) {
    stackFooter = (
      <Button
        className="w-full h-12 text-base active:scale-[0.97]"
        onClick={() => {
          navigator.vibrate?.(10);
          handleSubmit();
        }}
        disabled={
          isSubmitting ||
          quantity < 1 ||
          (actionMode !== "entry" && quantity > exitCeiling(product))
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
        disabled={isSubmitting || (exitReason === "loss" && !lossNote.trim())}
        className="w-full h-12 text-base active:scale-[0.97]"
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
        className="w-full h-12 text-base active:scale-[0.97]"
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
      {/* overflow-hidden : rien ne doit deborder, donc rien a faire defiler.
          overscroll-none coupe le rebond elastique d'iOS, qui donnait
          l'impression d'un ecran mobile alors qu'il n'y avait rien dessous.
          Les deux cartes se partagent ce qui reste, quelle que soit la
          hauteur de l'appareil. */}
      <div
        className="flex flex-col gap-3 overflow-hidden overscroll-none"
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
                <span className="block font-heading font-semibold text-2xl leading-none">
                  {label}
                </span>
                <span className="block text-sm text-muted-foreground leading-tight mt-1.5">
                  {hint}
                </span>
              </span>
            </motion.button>
          ))}
        </div>

        {/* Pied d'ecran : historique puis vehicules, colles en bas. La zone
            sure est deja retiree de la hauteur du conteneur. */}
        <div className="shrink-0 flex flex-col gap-2">
          <button
            onClick={() => setHistoryOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border bg-white dark:bg-card py-3.5 active:scale-[0.97] transition-transform"
          >
            <Clock className="size-[18px] text-muted-foreground" />
            <span className="font-semibold text-base">
              Historique
              {todayCount > 0 && (
                <span className="text-muted-foreground font-normal"> · {todayCount}</span>
              )}
            </span>
          </button>
          <button
            onClick={() => setVehicleOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border bg-white dark:bg-card py-3.5 active:scale-[0.97] transition-transform"
          >
            <Car className="size-[18px] text-muted-foreground" />
            <span className="font-semibold text-base">
              Véhicules
              {vehicles.length > 0 && (
                <span className="text-muted-foreground font-normal"> · {vehicles.length}</span>
              )}
            </span>
          </button>
        </div>
      </div>

      {/* ═══ HISTORIQUE DU JOUR ═══ */}
      <MobileHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        session={sessionEntries}
        older={olderEntries}
        isLoading={isLoadingToday}
        revertingKeys={revertingIds}
        onUndo={(key) => {
          const entry = session.find((e) => e.localId === key);
          if (entry) handleRevert(entry);
        }}
      />

      {/* ═══ VEHICULES ═══ */}
      <MobileVehicleSheet
        open={vehicleOpen}
        onOpenChange={setVehicleOpen}
        vehicles={vehicles}
        isLoading={isLoadingVehicles}
        onSelect={(v) => {
          // On ferme la liste et on pousse l'etat des lieux du vehicule choisi.
          setVehicleOpen(false);
          setInspectionVehicle(v);
        }}
      />

      {/* ═══ ETAT DES LIEUX ═══ */}
      <MobileVehicleInspection
        vehicle={inspectionVehicle}
        open={!!inspectionVehicle}
        onClose={() => setInspectionVehicle(null)}
      />

      {/* ═══════════════════════════════════════════════════════ */}
      {/* PILE D'ECRANS (etapes)                                 */}
      {/* ═══════════════════════════════════════════════════════ */}
      <MobileStackScreen
        open={drawerOpen && !batchScanOpen}
        title={drawerTitle}
        subtitle={
          // Pas avant que la destination soit reellement connue : sur l'ecran
          // de choix du technicien, exitDestination est encore vide.
          actionMode === "entry"
            ? stackSubtitleEntry
            : drawerStep !== "reason" && drawerStep !== "technicians"
              ? exitDestination || undefined
              : undefined
        }
        onBack={canGoBack ? drawerGoBack : undefined}
        onClose={closeDrawer}
        footer={stackFooter}
      >
        <div className="flex flex-col h-full">
          {/* ── En-tete d'etape ── */}
          {/* Masque hors des etapes qui le remplissent : vide, il volait une
              bande de vingt pixels aux ecrans qui doivent tenir sans defiler. */}
          <div
            className={cn(
              "px-4 pt-3 pb-2 shrink-0",
              drawerStep !== "products" && drawerStep !== "technicians" && "hidden"
            )}
          >
            {/* Scanner — entree comme sortie. C'est le chemin le plus court
                vers le bon produit : viser une etiquette bat toujours la
                lecture d'une grille. Il passe donc devant la recherche, en
                pleine largeur. */}
            {/* Bouton teinte, pas plein : le scan designe un produit, il ne
                valide rien. Le noir plein le mettait au meme rang que
                "Valider la sortie" et les deux se disputaient l'ecran. La
                teinte reste franchement visible tout en disant "action
                secondaire". */}
            {drawerStep === "products" && itemKind !== "equipment" && (
              <button
                onClick={() => setBatchScanOpen(true)}
                className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-primary/10 border border-primary/20 text-primary py-4 active:bg-primary/20 active:scale-[0.98] transition-all"
              >
                <ScanLine className="size-5" />
                <span className="font-semibold text-base">Scanner un QR code</span>
              </button>
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
                        ? `Ajouter un ${itemNoun} \u2014 ${exitDestination}\u2026`
                        : `Rechercher un ${itemNoun}\u2026`
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

          {/* ── Drawer body ── */}
          {/* Les etapes a contenu ferme — nature, societe, quantite — remplissent
              l'ecran sans defiler, comme l'accueil : ce qu'on doit lire avant de
              valider ne se cache pas sous le pli. Seules les listes, dont on ne
              connait pas la longueur, defilent. */}
          <div
            className={cn(
              "flex-1 min-h-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]",
              drawerStep === "reason" || drawerStep === "organization" || drawerStep === "kind"
                ? "flex flex-col overflow-hidden overscroll-none"
                : // La quantite tient dans l'ecran par construction : rien n'y
                  // defile. Le defilement reste malgre tout autorise, sans
                  // rebond, pour le seul cas ou la hauteur disponible fond —
                  // le clavier numerique qui s'ouvre sur le prix. L'interdire
                  // rendrait alors les champs du bas inatteignables.
                  drawerStep === "detail"
                  ? "flex flex-col overflow-y-auto overscroll-none"
                  : "overflow-y-auto"
            )}
          >
            {/* ═══ SOCIETE QUI RECOIT L'ENTREE ═══
                Memes cartes que partout : le choix engage tout le reste du
                parcours, il merite le meme poids que « entrée ou sortie ». */}
            {drawerStep === "organization" && (
              <div className="flex-1 min-h-0 flex flex-col gap-3 py-2">
                {organizations.map((org) => {
                  const logo = organizationLogo(org);
                  return (
                    <button
                      key={org.id}
                      onClick={() => selectEntryOrg(org.id)}
                      className="w-full flex-1 min-h-0 flex flex-col items-center justify-center gap-3 rounded-3xl border bg-white dark:bg-card px-5 active:scale-[0.98] transition-transform"
                    >
                      {/* Le logo est ce qui identifie la societe d'un coup d'oeil :
                        il porte la carte, le nom ne fait que confirmer. */}
                      {logo ? (
                        <img src={logo} alt="" className="size-24 object-contain" />
                      ) : (
                        <span className="size-24 rounded-3xl bg-muted flex items-center justify-center font-heading text-3xl font-bold">
                          {org.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <span className="text-center">
                        <span className="block font-heading font-semibold text-2xl leading-none">
                          {org.name}
                        </span>
                        <span className="block text-sm text-muted-foreground leading-tight mt-1.5">
                          Le stock entre chez {org.name}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ═══ PRODUIT OU OUTIL ═══
                Memes cartes que partout : un choix binaire garde le meme poids
                d'un bout a l'autre du parcours. */}
            {drawerStep === "kind" && (
              <div className="flex-1 min-h-0 flex flex-col gap-3 py-2">
                {ITEM_KIND_OPTIONS.map(({ kind, label, hint, icon: Icon, accent, tint }) => (
                  <button
                    key={kind}
                    onClick={() => selectItemKind(kind)}
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
                      <span className="block font-heading font-semibold text-2xl leading-none">
                        {label}
                      </span>
                      <span className="block text-sm text-muted-foreground leading-tight mt-1.5">
                        {hint}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* ═══ NATURE DE LA SORTIE (etape 2) ═══
                Memes cartes qu'a l'accueil : un choix binaire se presente
                partout de la meme facon dans cette application, sinon rien
                n'indique qu'on repond a une question de meme nature. */}
            {drawerStep === "reason" && (
              <div className="flex-1 min-h-0 flex flex-col gap-3 py-2">
                {EXIT_REASON_OPTIONS.map(({ reason, label, hint, icon: Icon, accent, tint }) => (
                  <button
                    key={reason}
                    onClick={() => selectExitReason(reason)}
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
                      <span className="block font-heading font-semibold text-2xl leading-none">
                        {label}
                      </span>
                      <span className="block text-sm text-muted-foreground leading-tight mt-1.5">
                        {hint}
                      </span>
                    </span>
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
                          <span className="size-9 rounded-full bg-muted flex items-center justify-center font-semibold shrink-0 text-sm">
                            {t.first_name[0]}
                            {t.last_name[0]}
                          </span>
                        }
                      />
                    ))}
                  </InsetGroup>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 py-14 px-6 text-center">
                    <PackagePlus className="size-12 text-muted-foreground/20" />
                    {debouncedSearch ? (
                      <>
                        <p className="text-base font-medium">Aucun technicien ne correspond</p>
                        <button
                          onClick={() => setSearchQuery("")}
                          className="text-base font-medium text-primary active:opacity-50"
                        >
                          Effacer la recherche
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-base font-medium">Aucun technicien</p>
                        <p className="text-sm text-muted-foreground">
                          Ajoutez-en depuis l&apos;ordinateur, dans Techniciens. En attendant,
                          revenez en arrière pour déclarer une erreur de stock.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ═══ PRODUCT LIST ═══ */}
            {drawerStep === "products" && (
              <div className="space-y-2 pt-1">
                {isSearching && debouncedSearch ? (
                  // Le squelette calque la grille : annoncer une autre mise en
                  // page ferait sauter l'ecran a l'arrivee des donnees.
                  <div className="grid grid-cols-2 gap-2.5 py-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="rounded-2xl border p-2.5 space-y-2">
                        <Skeleton className="w-full aspect-square rounded-xl" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-5 w-8" />
                          <Skeleton className="h-5 w-14 rounded-full" />
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
                      const stock = p.stock_current ?? 0;
                      // Une sortie ne peut pas depasser le stock : autant le
                      // dire ici plutot qu'a la validation, apres avoir fait
                      // remplir un panier pour rien.
                      const outOfStock = actionMode === "exit" && stock <= 0;
                      const cartQty = cart.find((item) => item.product.id === p.id)?.quantity ?? 0;
                      const consoleP: ConsoleProduct = {
                        id: p.id,
                        name: p.name,
                        sku: p.sku,
                        stock_current: stock,
                        stock_min: p.stock_min,
                        price: p.price ?? null,
                        icon_name: p.icon_name,
                        icon_color: p.icon_color,
                        image_url: p.image_url,
                        supplier_id: p.supplier_id,
                        supplier_name: p.supplier?.name ?? null,
                        other_org_stock: otherOrgStock(p.product_organization_stock),
                        org_stock: orgStockOf(p.product_organization_stock),
                      };

                      return (
                        <li key={p.id}>
                          <button
                            disabled={outOfStock}
                            onClick={() =>
                              actionMode === "exit"
                                ? toggleProductInCart(consoleP)
                                : selectProductSingle(consoleP)
                            }
                            className={cn(
                              "w-full h-full rounded-2xl border p-2.5 flex flex-col gap-2 text-left transition-colors",
                              outOfStock ? "opacity-45" : "active:scale-[0.97]",
                              inCart && "bg-primary/5 border-primary",
                              !inCart && status === "critique" && "border-critique/30"
                            )}
                          >
                            {/* La photo reste l'ancre : on reconnait un produit
                                avant de lire son nom. */}
                            <div className="relative w-full">
                              <ProductIconDisplay
                                iconName={p.icon_name}
                                iconColor={p.icon_color}
                                imageUrl={p.image_url}
                                size="xl"
                                className="w-full"
                              />
                              {inCart && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring", bounce: 0.35, duration: 0.4 }}
                                  className="absolute top-1.5 right-1.5 size-7 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/25"
                                >
                                  <Check className="size-4 text-primary-foreground" />
                                </motion.div>
                              )}
                              {outOfStock && (
                                <span className="absolute inset-x-1.5 bottom-1.5 rounded-lg bg-critique/90 py-1 text-center text-sm font-semibold text-white">
                                  Rupture
                                </span>
                              )}
                            </div>

                            {/* Nom, puis reference et rayon */}
                            <div className="min-w-0">
                              <p className="text-base font-medium leading-tight line-clamp-2 min-h-[2.4em]">
                                {p.name}
                              </p>
                              <p className="text-sm text-muted-foreground leading-tight truncate">
                                {p.sku && <span className="font-mono">{p.sku}</span>}
                                {p.sku && p.category?.name && " · "}
                                {p.category?.name}
                              </p>
                            </div>

                            {/* Etat du stock : le chiffre et son verdict.
                                La jauge disait une troisieme fois ce que le
                                chiffre et la pastille disaient deja. */}
                            <div className="mt-auto w-full flex items-center justify-between gap-1">
                              <span
                                className={cn(
                                  "font-heading font-bold tabular-nums text-xl leading-none",
                                  inCart && "text-primary",
                                  !inCart && status === "critique" && "text-critique",
                                  !inCart && status === "attention" && "text-attention"
                                )}
                              >
                                {inCart ? `×${cartQty}` : stock}
                              </span>
                              <StatusPill status={status} className="whitespace-nowrap" />
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 py-14 px-6 text-center">
                    <Package className="size-12 text-muted-foreground/20" />
                    {/* Un etat vide doit dire quoi faire ensuite, sinon il ne
                        fait que constater l'echec. */}
                    {debouncedSearch ? (
                      <>
                        <p className="text-base font-medium">Aucun {itemNoun} ne correspond</p>
                        <p className="text-sm text-muted-foreground">
                          Vérifiez l&apos;orthographe, ou effacez la recherche pour revoir toute la
                          liste.
                        </p>
                        <button
                          onClick={() => setSearchQuery("")}
                          className="mt-1 text-base font-medium text-primary active:opacity-50"
                        >
                          Effacer la recherche
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-base font-medium">Aucun {itemNoun}</p>
                        <p className="text-sm text-muted-foreground">
                          {itemKind === "equipment"
                            ? "Les outils se créent depuis l'ordinateur, dans Outillage."
                            : "Les produits se créent depuis l'ordinateur, dans Produits."}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ═══ QUANTITE — l'ecran ou l'on engage le mouvement ═══ */}
            {drawerStep === "detail" &&
              product &&
              (() => {
                const isEntry = actionMode === "entry";
                // La societe debitee se recalcule a chaque unite : passer de 4 a
                // 8 peut faire basculer la sortie de SMPR vers SEIREN, et
                // l'ecran doit le dire au moment ou cela arrive.
                const source = isEntry ? null : exitSourceFor(product, quantity);
                const sourceStock = source?.stock ?? product.stock_current;
                const previewStock = isEntry
                  ? product.stock_current + quantity
                  : Math.max(0, sourceStock - quantity);
                const previewStatus = getStockBadgeVariant(
                  calculateStockScore(previewStock, product.stock_min)
                );
                const max = isEntry ? Infinity : exitCeiling(product);
                // Ce que gardent les autres societes, une fois la source mise
                // de cote — en entree, tout ce qui n'est pas la societe qui recoit.
                const elsewhere = isEntry
                  ? (product.other_org_stock ?? [])
                  : (product.org_stock ?? []).filter((o) => o.id !== source?.id && o.stock > 0);
                const priceNum = unitPrice ? parseFloat(unitPrice) : 0;
                const isToday = entryDate.toDateString() === todayDate.toDateString();

                return (
                  // Colonne pleine hauteur : les blocs a hauteur fixe se posent,
                  // le compteur absorbe ce qui reste. L'ecran tient donc sur un
                  // grand telephone comme sur un petit, sans jamais defiler.
                  <div className="flex flex-1 min-h-0 flex-col gap-3 pt-2 pb-2">
                    {/* Identite du produit — discrete : on sait deja lequel
                        on a choisi, elle sert a confirmer, pas a decider. */}
                    <div className="flex shrink-0 items-center gap-3 px-1">
                      <ProductIconDisplay
                        iconName={product.icon_name}
                        iconColor={product.icon_color}
                        imageUrl={product.image_url}
                        size="lg"
                        className="shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h2 className="font-heading text-lg font-semibold leading-tight line-clamp-2">
                          {product.name}
                        </h2>
                        {product.sku && (
                          <p className="text-sm text-muted-foreground font-mono leading-tight mt-0.5">
                            {product.sku}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Le nombre est le sujet de l'ecran : il occupe le centre
                        et les commandes l'encadrent, au lieu d'un champ de
                        formulaire noye parmi les autres.

                        C'est aussi lui qui respire : sur un grand ecran il
                        s'etale, sur un petit il se resserre — plutot que de
                        pousser le formulaire d'achat hors du cadre. */}
                    <div className="flex flex-1 min-h-0 items-center justify-center gap-5">
                      <button
                        onClick={() => {
                          navigator.vibrate?.(8);
                          setQuantity((q) => Math.max(1, q - 1));
                        }}
                        disabled={quantity <= 1}
                        aria-label="Retirer une unité"
                        className="size-16 [@media(max-height:720px)]:size-[3.25rem] rounded-full bg-muted/70 flex items-center justify-center shrink-0 active:bg-muted active:scale-95 transition-transform disabled:opacity-25"
                      >
                        <Minus className="size-7 [@media(max-height:720px)]:size-6" />
                      </button>

                      <div className="text-center min-w-[6rem]">
                        <Input
                          ref={quantityInputRef}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={isEntry ? undefined : max}
                          value={quantity}
                          onChange={(e) =>
                            setQuantity(Math.max(1, Math.min(parseInt(e.target.value) || 1, max)))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              navigator.vibrate?.(10);
                              handleSubmit();
                            }
                          }}
                          className="h-auto w-full border-0 bg-transparent p-0 text-center font-heading text-6xl [@media(max-height:720px)]:text-5xl font-bold tabular-nums shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          {quantity > 1 ? "unités" : "unité"}
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          navigator.vibrate?.(8);
                          setQuantity((q) => Math.min(q + 1, max));
                        }}
                        disabled={!isEntry && quantity >= max}
                        aria-label="Ajouter une unité"
                        className="size-16 [@media(max-height:720px)]:size-[3.25rem] rounded-full bg-muted/70 flex items-center justify-center shrink-0 active:bg-muted active:scale-95 transition-transform disabled:opacity-25"
                      >
                        <Plus className="size-7 [@media(max-height:720px)]:size-6" />
                      </button>
                    </div>

                    {/* La consequence, en clair. Elle etait tassee dans un coin
                        alors que c'est ce que l'on verifie avant de valider. */}
                    <InsetGroup
                      className="shrink-0"
                      footer={
                        !isEntry && source
                          ? "On puise chez la société qui en a le moins."
                          : undefined
                      }
                    >
                      {/* Qui est debite. L'utilisateur ne l'a pas choisi : la
                          regle l'a designe. Le taire reviendrait a modifier un
                          stock sans dire lequel. */}
                      {!isEntry && source && (
                        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
                          <span className="text-base">Sortie de</span>
                          <span className="flex items-baseline gap-2">
                            <span className="font-heading text-lg font-semibold">
                              {source.name}
                            </span>
                            <span className="text-sm text-muted-foreground tabular-nums">
                              {source.stock} en stock
                            </span>
                          </span>
                        </div>
                      )}

                      {/* « Ailleurs » et non « disponible » : ce stock existe
                          mais n'est pas mobilisable dans ce mouvement — une
                          sortie ne puise que dans une seule societe. Le dire
                          oriente vers un transfert quand le stock local est
                          court, sans laisser croire qu'on peut le prendre. */}
                      {elsewhere.length > 0 && (
                        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
                          <span className="text-sm text-muted-foreground">Ailleurs</span>
                          <span className="flex items-baseline gap-3">
                            {elsewhere.map((o) => (
                              <span key={o.name} className="flex items-baseline gap-1.5">
                                <span className="text-sm text-muted-foreground">{o.name}</span>
                                {/* Le chiffre reprend le poids du reste de
                                    l'ecran : en gris clair il se lisait comme
                                    une note de bas de page, alors que c'est lui
                                    qui declenche un transfert. */}
                                <span className="font-heading text-lg font-bold tabular-nums">
                                  {o.stock}
                                </span>
                              </span>
                            ))}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-3 px-4 py-3">
                        {/* En sortie, l'avant et l'apres portent sur la seule
                            societe debitee : afficher le cumul a gauche et le
                            reste d'une societe a droite ferait une soustraction
                            fausse sous les yeux de l'utilisateur. */}
                        <span className="text-base">
                          {isEntry || !source ? "Stock après" : `Stock ${source.name} après`}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-base text-muted-foreground tabular-nums">
                            {isEntry ? product.stock_current : sourceStock}
                          </span>
                          <span className="text-muted-foreground">&rarr;</span>
                          <motion.span
                            key={previewStock}
                            initial={{ scale: 1.18 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", bounce: 0.3, duration: 0.35 }}
                            className={cn(
                              "font-heading text-2xl font-bold tabular-nums leading-none",
                              previewStatus === "critique" && "text-critique",
                              previewStatus === "attention" && "text-attention"
                            )}
                          >
                            {previewStock}
                          </motion.span>
                          <StatusPill status={previewStatus} className="whitespace-nowrap" />
                        </div>
                      </div>
                    </InsetGroup>

                    {/* Achat — uniquement en entree */}
                    {isEntry && (
                      <InsetGroup
                        className="shrink-0"
                        header="Achat"
                        footer={
                          product.supplier_name
                            ? `Fournisseur : ${product.supplier_name}`
                            : "Aucun fournisseur sur cette fiche produit."
                        }
                      >
                        <InsetField label="Prix unitaire" hint="HT">
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min={0}
                              placeholder="0,00"
                              value={unitPrice}
                              onChange={(e) => setUnitPrice(e.target.value)}
                              className="h-auto w-24 border-0 bg-transparent p-0 text-right text-base tabular-nums shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                            <span className="text-base text-muted-foreground">&euro;</span>
                          </div>
                        </InsetField>

                        <InsetField label="Facture" hint="optionnel">
                          <Input
                            type="text"
                            placeholder="Référence"
                            value={invoiceRef}
                            onChange={(e) => setInvoiceRef(e.target.value)}
                            className="h-auto w-full border-0 bg-transparent p-0 text-right text-base shadow-none focus-visible:ring-0"
                          />
                        </InsetField>

                        <InsetField label="Date">
                          <DatePicker
                            value={entryDate}
                            onChange={(d) => setEntryDate(d ?? todayDate)}
                            disabled={{ after: todayDate, before: ninetyDaysAgo }}
                            placeholder={isToday ? "Aujourd'hui" : undefined}
                            className="h-9 w-auto border-0 bg-transparent px-0 text-base shadow-none"
                            popoverClassName="z-[60]"
                          />
                        </InsetField>

                        {/* Le total appartient au groupe : c'est le resultat
                            des lignes au-dessus, pas une note de bas de page. */}
                        <InsetField label="Total">
                          <span
                            className={cn(
                              "font-heading text-lg font-semibold tabular-nums",
                              priceNum > 0 ? "text-foreground" : "text-muted-foreground"
                            )}
                          >
                            {(quantity * priceNum).toLocaleString("fr-FR", {
                              style: "currency",
                              currency: "EUR",
                            })}
                          </span>
                        </InsetField>
                      </InsetGroup>
                    )}
                  </div>
                );
              })()}

            {/* ═══ PANIER — ce qui va etre enregistre ═══ */}
            {drawerStep === "cart" && (
              <div className="space-y-5 pt-2 pb-4">
                {/* A qui cela part. On s'apprete a engager un mouvement au nom
                    de quelqu'un : le rappeler ici evite de valider pour le
                    mauvais technicien apres avoir rempli le panier. */}
                <InsetGroup header="Sortie vers">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                        exitReason === "loss"
                          ? "bg-attention-bg text-attention"
                          : "bg-primary/10 text-primary"
                      )}
                    >
                      {exitReason === "loss" ? (
                        <ArrowUpFromLine className="size-4" />
                      ) : (
                        `${selectedTech?.first_name?.[0] ?? ""}${selectedTech?.last_name?.[0] ?? ""}`
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-base font-medium">
                      {exitDestination}
                    </span>
                  </div>
                </InsetGroup>

                {/* Motif — obligatoire pour une erreur de stock. Une perte sans
                    raison ne se relit pas : le journal doit dire pourquoi le
                    stock a baisse, pas seulement de combien. */}
                {exitReason === "loss" && (
                  <InsetGroup
                    header="Motif de l'erreur"
                    footer="Obligatoire — ex. : casse, vol, égaré, écart d'inventaire."
                  >
                    <div className="px-4 py-3">
                      <Input
                        value={lossNote}
                        onChange={(e) => setLossNote(e.target.value)}
                        placeholder="Pourquoi ce retrait ?"
                        className="h-11 rounded-xl border-0 bg-muted/50 text-base"
                      />
                    </div>
                  </InsetGroup>
                )}

                {/* Le detail. Le bouton d'ajout vit dans l'en-tete du groupe :
                    c'est la meme famille d'action que la liste elle-meme. */}
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between px-1">
                    <p className="text-sm uppercase tracking-wide text-muted-foreground">
                      {cart.length} produit{cart.length > 1 ? "s" : ""} &middot; {cartTotalItems}{" "}
                      unité{cartTotalItems > 1 ? "s" : ""}
                    </p>
                    <button
                      onClick={() => {
                        setDrawerStep("products");
                        setSearchQuery("");
                      }}
                      className="text-base font-medium text-primary active:opacity-50"
                    >
                      + Ajouter
                    </button>
                  </div>

                  <div className="overflow-hidden rounded-xl border bg-white dark:bg-card">
                    {cart.map((item) => {
                      // Chaque ligne a sa propre societe source : le panier
                      // peut melanger un produit pris chez SMPR et le suivant
                      // chez SEIREN. Le stock affiche est donc celui de la
                      // societe qui fournira cette ligne, pas un cumul.
                      const lineSource = exitSourceFor(item.product, item.quantity);
                      const stock = lineSource?.stock ?? item.product.stock_current;
                      const after = stock - item.quantity;
                      // Le stock peut avoir baisse depuis la selection : la
                      // synchronisation temps reel le fait bouger sous nos
                      // yeux. Mieux vaut le voir ici qu'a la validation.
                      const excess = item.quantity > stock;

                      return (
                        <SwipeToActionRow
                          key={item.product.id}
                          label="Retirer"
                          icon={<Trash2 className="size-4" />}
                          onAction={() => removeFromCart(item.product.id)}
                        >
                          <div className="flex items-center gap-3 px-4 py-3">
                            <ProductIconDisplay
                              iconName={item.product.icon_name}
                              iconColor={item.product.icon_color}
                              imageUrl={item.product.image_url}
                              size="md"
                              className="shrink-0"
                            />

                            {/* Le nom respire : la corbeille a laisse sa place */}
                            <div className="min-w-0 flex-1">
                              <p className="text-base font-medium leading-tight line-clamp-2">
                                {item.product.name}
                              </p>
                              <p
                                className={cn(
                                  "text-sm leading-tight",
                                  excess ? "font-medium text-critique" : "text-muted-foreground"
                                )}
                              >
                                {excess
                                  ? `Stock insuffisant — ${stock} disponible${stock > 1 ? "s" : ""}`
                                  : lineSource
                                    ? `${lineSource.name} · reste ${after} sur ${stock}`
                                    : `Reste ${after} sur ${stock}`}
                              </p>
                            </div>

                            {/* Compteur compact mais toujours a 44px de cible */}
                            <div className="flex shrink-0 items-center gap-0.5">
                              <button
                                onClick={() => {
                                  navigator.vibrate?.(8);
                                  updateCartQty(item.product.id, -1);
                                }}
                                disabled={item.quantity <= 1}
                                aria-label="Retirer une unité"
                                className="flex size-11 items-center justify-center rounded-full active:bg-muted active:scale-95 transition-transform disabled:opacity-25"
                              >
                                <Minus className="size-5" />
                              </button>
                              <input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={stock}
                                value={item.quantity}
                                onChange={(e) =>
                                  setCartQty(
                                    item.product.id,
                                    Math.min(parseInt(e.target.value) || 1, stock)
                                  )
                                }
                                aria-label={`Quantité de ${item.product.name}`}
                                className={cn(
                                  "w-9 bg-transparent text-center font-heading text-xl font-bold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                                  excess && "text-critique"
                                )}
                              />
                              <button
                                onClick={() => {
                                  navigator.vibrate?.(8);
                                  updateCartQty(item.product.id, 1);
                                }}
                                disabled={item.quantity >= stock}
                                aria-label="Ajouter une unité"
                                className="flex size-11 items-center justify-center rounded-full active:bg-muted active:scale-95 transition-transform disabled:opacity-25"
                              >
                                <Plus className="size-5" />
                              </button>
                            </div>
                          </div>
                        </SwipeToActionRow>
                      );
                    })}
                  </div>

                  <p className="px-1 text-sm text-muted-foreground">
                    Glissez une ligne vers la gauche pour la retirer.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </MobileStackScreen>

      {/* ── QR Scanner Modal (batch — tech mode) ── */}
      {/* En sortie le scan est continu : on charge un camion, article apres
          article. En entree il rend la main aussitot, chaque reception ayant
          son prix et sa date a saisir. */}
      <QrScannerModal
        open={batchScanOpen}
        onClose={() => {
          setBatchScanOpen(false);
          // Wait for scanner to fully unmount, then reopen drawer on cart
          if (actionMode === "exit" && cart.length > 0) {
            setTimeout(() => {
              setDrawerStep("cart");
              setDrawerOpen(true);
            }, 150);
          }
        }}
        onScan={actionMode === "exit" ? handleBatchScan : handleEntryScan}
        continuous={actionMode === "exit"}
        title={actionMode === "exit" ? `Scanner pour ${exitDestination}` : "Scanner une entrée"}
        bottomContent={
          actionMode === "exit" && cart.length > 0 ? (
            <button
              onClick={() => setBatchScanOpen(false)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-foreground py-3 font-semibold text-base active:scale-[0.97] transition-all"
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
            /* Cet ecran imitait InsetGroup et InsetRow a la main : meme cadre,
               memes separateurs, ecrits en double. Il les utilise desormais,
               donc un changement du systeme l'atteint aussi. */
            <div className="mx-4 mb-4 space-y-4">
              <InsetGroup header="Produit scanné">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium">{scannedProduct.name}</p>
                    {scannedProduct.sku && (
                      <p className="font-mono text-sm text-muted-foreground">
                        {scannedProduct.sku}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-heading text-xl font-bold tabular-nums">
                      {scannedProduct.stock_current}
                    </span>
                    <StatusPill
                      status={getStockBadgeVariant(
                        calculateStockScore(scannedProduct.stock_current, scannedProduct.stock_min)
                      )}
                      className="whitespace-nowrap"
                    />
                  </div>
                </div>
              </InsetGroup>

              <InsetGroup header="Que faire ?">
                {ACTION_OPTIONS.map(({ mode, label, hint, icon: ActionIcon, accent, tint }) => (
                  <InsetRow
                    key={mode}
                    onClick={() => handleScanAction(mode)}
                    title={label}
                    subtitle={hint}
                    leading={
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-full",
                          tint
                        )}
                      >
                        <ActionIcon className={cn("size-4", accent)} />
                      </span>
                    }
                  />
                ))}
              </InsetGroup>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
