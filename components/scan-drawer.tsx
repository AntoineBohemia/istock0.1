"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Loader2,
  Minus,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import ProductIconDisplay from "@/components/product-icon-display";
import { useTechnicians, useAvailableProductsForRestock } from "@/hooks/queries";
import { useAddToTechnicianInventory } from "@/hooks/mutations";
import type { RestockItem } from "@/lib/supabase/queries/inventory";
import { cn } from "@/lib/utils";
import { parseProductQr } from "@/lib/utils/qr";
import { getRearCameraId } from "@/lib/utils/camera";

function daysSinceRestock(dateString: string | null): number | null {
  if (!dateString) return null;
  const diff = Date.now() - new Date(dateString).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function restockBadgeLabel(days: number | null): string {
  if (days === null) return "Jamais";
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  return `${days}j`;
}

function restockBadgeVariant(days: number | null): "destructive" | "secondary" | "outline" {
  if (days === null || days > 21) return "destructive";
  if (days > 14) return "secondary";
  return "outline";
}

const SCAN_DEBOUNCE_MS = 2000;

interface SelectedProduct {
  productId: string;
  name: string;
  sku: string | null;
  icon_name: string | null;
  icon_color: string | null;
  image_url: string | null;
  stock_current: number | null;
  quantity: number;
}

type Step = "technician" | "scan";

interface ScanDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedTechnicianId?: string | null;
}

export default function ScanDrawer({ open, onOpenChange, preselectedTechnicianId }: ScanDrawerProps) {
  const { currentOrganization } = useOrganizationStore();
  const orgId = currentOrganization?.id;
  const pathname = usePathname();

  const { data: technicians = [], isLoading: isLoadingTechnicians } =
    useTechnicians(orgId);
  const { data: products = [], isLoading: isLoadingProducts } =
    useAvailableProductsForRestock(orgId);
  const addToInventoryMutation = useAddToTechnicianInventory();

  const [step, setStep] = useState<Step>("technician");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [technicianSearch, setTechnicianSearch] = useState("");

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ text: string; time: number } | null>(null);

  const isSubmitting = addToInventoryMutation.isPending;

  const selectedTechnician = technicians.find((t) => t.id === selectedTechnicianId);

  // Filter technicians by search query
  const filteredTechnicians = useMemo(() => {
    if (!technicianSearch.trim()) return technicians;
    const query = technicianSearch.toLowerCase().trim();
    return technicians.filter((t) => {
      const fullName = `${t.first_name} ${t.last_name}`.toLowerCase();
      return fullName.includes(query);
    });
  }, [technicians, technicianSearch]);

  // Skip technician step when preselected
  useEffect(() => {
    if (open && preselectedTechnicianId) {
      setSelectedTechnicianId(preselectedTechnicianId);
      setStep("scan");
    }
  }, [open, preselectedTechnicianId]);

  // Close drawer on route change
  useEffect(() => {
    if (open) onOpenChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Reset state when drawer closes
  useEffect(() => {
    if (!open) {
      // Small delay so the closing animation plays with content visible
      const timer = setTimeout(() => {
        setStep("technician");
        setSelectedTechnicianId(null);
        setSelectedProducts([]);
        setCameraActive(false);
        setShowSearch(false);
        setTechnicianSearch("");
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // ── Scanner logic ──────────────────────────────────────────────────

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) {
          await scannerRef.current.stop();
        }
      } catch {
        // Ignore stop errors
      }
      scannerRef.current = null;
    }
  }, []);

  const addOrIncrementProduct = useCallback(
    (productId: string) => {
      const product = products.find((p) => p.id === productId);
      if (!product) {
        toast.error("Produit non trouve dans le stock");
        return;
      }

      setSelectedProducts((prev) => {
        const existing = prev.find((p) => p.productId === productId);
        if (existing) {
          toast.success(`${product.name} - quantite augmentee`);
          return prev.map((p) =>
            p.productId === productId
              ? { ...p, quantity: Math.min(p.quantity + 1, p.stock_current ?? 999) }
              : p
          );
        }
        toast.success(`${product.name} ajoute`);
        return [
          {
            productId: product.id,
            name: product.name,
            sku: product.sku,
            icon_name: product.icon_name ?? null,
            icon_color: product.icon_color ?? null,
            image_url: product.image_url,
            stock_current: product.stock_current,
            quantity: 1,
          },
          ...prev,
        ];
      });
    },
    [products]
  );

  const handleScanResult = useCallback(
    (decodedText: string) => {
      // Debounce: ignore same QR within SCAN_DEBOUNCE_MS
      const now = Date.now();
      if (
        lastScanRef.current &&
        lastScanRef.current.text === decodedText &&
        now - lastScanRef.current.time < SCAN_DEBOUNCE_MS
      ) {
        return;
      }
      lastScanRef.current = { text: decodedText, time: now };

      const productId = parseProductQr(decodedText);
      if (!productId) {
        toast.error("Format QR invalide");
        return;
      }

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }

      addOrIncrementProduct(productId);
    },
    [addOrIncrementProduct]
  );

  // Auto-start camera when entering scan step
  useEffect(() => {
    if (step === "scan" && open) {
      setCameraActive(true);
    }
  }, [step, open]);

  // Start/stop scanner when cameraActive changes
  useEffect(() => {
    if (!cameraActive || step !== "scan") {
      stopScanner();
      return;
    }

    let mounted = true;
    setCameraStarting(true);

    const startScanner = async () => {
      // Wait for DOM
      await new Promise((r) => setTimeout(r, 100));
      if (!mounted) return;

      const scanConfig = {
        fps: 5,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const size = Math.min(viewfinderWidth, viewfinderHeight) * 0.7;
          return { width: size, height: size };
        },
      };
      const onSuccess = (text: string) => handleScanResult(text);
      const onFailure = () => {/* no QR in frame - ignore */};

      try {
        const scanner = new Html5Qrcode("qr-reader-drawer");
        scannerRef.current = scanner;

        // Try to get rear camera by deviceId (most reliable on iPhone)
        const rearId = await getRearCameraId();

        if (rearId) {
          await scanner.start(
            { deviceId: { exact: rearId } },
            scanConfig, onSuccess, onFailure
          );
        } else {
          await scanner.start(
            { facingMode: "environment" },
            scanConfig, onSuccess, onFailure
          );
        }

        if (mounted) setCameraStarting(false);
      } catch (err) {
        if (!mounted) return;
        setCameraStarting(false);
        setCameraActive(false);

        if (err instanceof Error) {
          if (
            err.message.includes("Permission") ||
            err.message.includes("NotAllowedError")
          ) {
            toast.error("Acces a la camera refuse. Autorisez la camera dans les parametres.");
          } else if (err.message.includes("NotFoundError")) {
            toast.error("Aucune camera detectee.");
          } else {
            toast.error(`Erreur camera: ${err.message}`);
          }
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      stopScanner();
    };
  }, [cameraActive, step, handleScanResult, stopScanner]);

  // Stop camera when leaving scan step or closing drawer
  useEffect(() => {
    if (step !== "scan" || !open) {
      setCameraActive(false);
    }
  }, [step, open]);

  // ── Product list handlers ──────────────────────────────────────────

  const handleQuantityChange = (productId: string, quantity: number) => {
    const product = selectedProducts.find((p) => p.productId === productId);
    if (!product) return;
    const max = product.stock_current ?? 999;
    const clamped = Math.max(1, Math.min(quantity, max));
    setSelectedProducts((prev) =>
      prev.map((p) =>
        p.productId === productId ? { ...p, quantity: clamped } : p
      )
    );
  };

  const handleRemoveProduct = (productId: string) => {
    setSelectedProducts((prev) => prev.filter((p) => p.productId !== productId));
  };

  const handleAddManual = (productId: string) => {
    addOrIncrementProduct(productId);
    setShowSearch(false);
  };

  // ── Submit ─────────────────────────────────────────────────────────

  const handleSubmit = () => {
    if (!selectedTechnicianId || selectedProducts.length === 0) return;

    const items: RestockItem[] = selectedProducts.map((p) => ({
      productId: p.productId,
      quantity: p.quantity,
    }));

    addToInventoryMutation.mutate(
      { technicianId: selectedTechnicianId, items },
      {
        onSuccess: () => {
          const total = items.reduce((s, i) => s + i.quantity, 0);
          toast.success(
            `${total} item(s) ajoute(s) a ${selectedTechnician?.first_name} ${selectedTechnician?.last_name}`
          );
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : "Erreur lors de l'enregistrement"
          );
        },
      }
    );
  };

  const totalItems = selectedProducts.reduce((sum, p) => sum + p.quantity, 0);

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <Drawer open={open} onOpenChange={onOpenChange} dismissible={!isSubmitting}>
      <DrawerContent className="!h-[95dvh]">
        {step === "technician" ? (
          <>
            <DrawerHeader className="pb-2">
              <DrawerTitle>Choisir un technicien</DrawerTitle>
              <DrawerDescription>
                Selectionnez le technicien a restocker
              </DrawerDescription>
            </DrawerHeader>

            <div className="flex-1 overflow-auto px-4 pb-4">
              {isLoadingTechnicians ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              ) : technicians.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Aucun technicien trouve
                </p>
              ) : (
                <>
                  <div className="sticky top-0 z-10 bg-background pb-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher un technicien..."
                        value={technicianSearch}
                        onChange={(e) => setTechnicianSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {filteredTechnicians.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        Aucun technicien trouve
                      </p>
                    ) : (
                      filteredTechnicians.map((tech) => {
                        const days = daysSinceRestock(tech.last_restock_at);
                        return (
                          <Button
                            key={tech.id}
                            variant="outline"
                            className="w-full min-h-11 justify-start text-left"
                            onClick={() => {
                              setSelectedTechnicianId(tech.id);
                              setStep("scan");
                            }}
                          >
                            <span className="truncate">
                              {tech.first_name} {tech.last_name}
                            </span>
                            <Badge variant={restockBadgeVariant(days)} className="ml-auto shrink-0">
                              {restockBadgeLabel(days)}
                            </Badge>
                          </Button>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Scan step header - compact & sticky */}
            <DrawerHeader className="flex-row items-center gap-2 py-2 px-3 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 size-8"
                onClick={() => {
                  setStep("technician");
                  setSelectedProducts([]);
                  setShowSearch(false);
                }}
              >
                <ArrowLeft className="size-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <DrawerTitle className="truncate text-sm">
                  {selectedTechnician?.first_name} {selectedTechnician?.last_name}
                </DrawerTitle>
                <DrawerDescription className="text-xs">
                  Scannez ou recherchez des produits
                </DrawerDescription>
              </div>
            </DrawerHeader>

            {/* Sticky action bar */}
            <div className="flex gap-2 px-3 pb-2 shrink-0">
              <Button
                variant={cameraActive ? "default" : "outline"}
                className="flex-1 min-h-10"
                onClick={() => setCameraActive(!cameraActive)}
              >
                {cameraActive ? (
                  <>
                    <CameraOff className="mr-1.5 size-4" />
                    Arreter
                  </>
                ) : (
                  <>
                    <Camera className="mr-1.5 size-4" />
                    Scanner
                  </>
                )}
              </Button>
              <Button
                variant={showSearch ? "default" : "outline"}
                className="min-h-10"
                onClick={() => setShowSearch(!showSearch)}
              >
                <Search className="size-4" />
              </Button>
            </div>

            {/* Scrollable content area */}
            <div className="relative flex-1 min-h-0 overflow-auto px-3 space-y-2">
              {/* Camera zone */}
              {cameraActive && (
                <div className="relative shrink-0 overflow-hidden rounded-lg bg-black">
                  <div
                    id="qr-reader-drawer"
                    className="w-full"
                  />
                  {cameraStarting && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="text-center text-white">
                        <Camera className="mx-auto size-6 animate-pulse" />
                        <p className="mt-1 text-xs">Demarrage...</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Manual search - overlay style */}
              {showSearch && (
                <Command className="rounded-lg border">
                  <CommandInput placeholder="Rechercher un produit..." />
                  <CommandList className="max-h-48">
                    <CommandEmpty>Aucun produit trouve</CommandEmpty>
                    <CommandGroup>
                      {products.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={`${p.name} ${p.sku}`}
                          onSelect={() => handleAddManual(p.id)}
                          className="flex items-center gap-2"
                        >
                          <ProductIconDisplay
                            iconName={p.icon_name}
                            iconColor={p.icon_color}
                            imageUrl={p.image_url}
                            size="sm"
                            className="shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Stock: {p.stock_current}
                            </p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              )}

              {/* Summary counter */}
              {selectedProducts.length > 0 && (
                <p className="text-xs text-muted-foreground px-0.5">
                  {selectedProducts.length} produit{selectedProducts.length > 1 ? "s" : ""} · {totalItems} item{totalItems > 1 ? "s" : ""}
                </p>
              )}

              {/* Scanned products list */}
              {selectedProducts.length > 0 && (
                <div className="space-y-1.5 pb-2">
                  {selectedProducts.map((product) => (
                    <div
                      key={product.productId}
                      className="flex items-center gap-2 rounded-lg border p-2"
                    >
                      <ProductIconDisplay
                        iconName={product.icon_name}
                        iconColor={product.icon_color}
                        imageUrl={product.image_url}
                        size="sm"
                        className="shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium leading-tight">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Stock: {product.stock_current ?? 0}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-7"
                          onClick={() =>
                            handleQuantityChange(product.productId, product.quantity - 1)
                          }
                          disabled={product.quantity <= 1}
                        >
                          <Minus className="size-3" />
                        </Button>
                        <span className="w-7 text-center text-sm font-medium tabular-nums">
                          {product.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-7"
                          onClick={() =>
                            handleQuantityChange(product.productId, product.quantity + 1)
                          }
                          disabled={product.quantity >= (product.stock_current ?? 0)}
                        >
                          <Plus className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveProduct(product.productId)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedProducts.length === 0 && !showSearch && !cameraActive && (
                <div className="rounded-lg border border-dashed p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Scannez un QR code ou recherchez un produit
                  </p>
                </div>
              )}
            </div>

            {/* Sticky footer with safe area */}
            <DrawerFooter className="border-t py-3 px-3 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <Button
                className="w-full min-h-11"
                disabled={selectedProducts.length === 0 || isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                {selectedProducts.length > 0
                  ? `Enregistrer (${totalItems} item${totalItems > 1 ? "s" : ""})`
                  : "Enregistrer"}
              </Button>
            </DrawerFooter>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
