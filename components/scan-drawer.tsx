"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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

// QR code patterns (same as legacy qr-scanner-modal)
const LEGACY_PATTERN = /^smpr:\/\/product\/([a-zA-Z0-9-]+)$/;
const URL_PATTERN = /^https?:\/\/[^/]+\/stock\?product=([a-zA-Z0-9-]+)/;

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
}

export default function ScanDrawer({ open, onOpenChange }: ScanDrawerProps) {
  const { currentOrganization } = useOrganizationStore();
  const orgId = currentOrganization?.id;

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

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ text: string; time: number } | null>(null);

  const isSubmitting = addToInventoryMutation.isPending;

  const selectedTechnician = technicians.find((t) => t.id === selectedTechnicianId);

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

      // Parse QR
      let match = decodedText.match(LEGACY_PATTERN);
      if (!match) {
        match = decodedText.match(URL_PATTERN);
      }

      if (!match) {
        toast.error("Format QR invalide");
        return;
      }

      const productId = match[1];
      const product = products.find((p) => p.id === productId);

      if (!product) {
        toast.error("Produit non trouve dans le stock");
        return;
      }

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }

      // Add or increment
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

      try {
        const scanner = new Html5Qrcode("qr-reader-drawer");
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (text) => handleScanResult(text),
          () => {
            /* no QR in frame - ignore */
          }
        );

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
    const max = product.stock_current ?? 0;
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
    const product = products.find((p) => p.id === productId);
    if (!product) return;

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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        {step === "technician" ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Choisir un technicien</DrawerTitle>
              <DrawerDescription>
                Selectionnez le technicien a restocker
              </DrawerDescription>
            </DrawerHeader>

            <div className="flex-1 overflow-auto px-4 pb-4">
              {isLoadingTechnicians ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              ) : technicians.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Aucun technicien trouve
                </p>
              ) : (
                <div className="space-y-2">
                  {technicians.map((tech) => (
                    <Button
                      key={tech.id}
                      variant="outline"
                      className="w-full min-h-12 justify-start text-left"
                      onClick={() => {
                        setSelectedTechnicianId(tech.id);
                        setStep("scan");
                      }}
                    >
                      <span className="truncate">
                        {tech.first_name} {tech.last_name}
                      </span>
                      <Badge variant="secondary" className="ml-auto shrink-0">
                        {tech.inventory_count} items
                      </Badge>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Scan step header */}
            <DrawerHeader className="flex-row items-center gap-2 pb-2">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => {
                  setStep("technician");
                  setSelectedProducts([]);
                }}
              >
                <ArrowLeft className="size-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <DrawerTitle className="truncate">
                  {selectedTechnician?.first_name} {selectedTechnician?.last_name}
                </DrawerTitle>
                <DrawerDescription>
                  Scannez ou recherchez des produits
                </DrawerDescription>
              </div>
            </DrawerHeader>

            <div className="flex-1 overflow-auto px-4 space-y-3">
              {/* Camera zone */}
              {cameraActive && (
                <div className="relative overflow-hidden rounded-lg bg-black">
                  <div
                    id="qr-reader-drawer"
                    className="w-full"
                    style={{ minHeight: "240px" }}
                  />
                  {cameraStarting && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="text-center text-white">
                        <Camera className="mx-auto size-8 animate-pulse" />
                        <p className="mt-2 text-sm">Demarrage de la camera...</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Camera toggle + search button */}
              <div className="flex gap-2">
                <Button
                  variant={cameraActive ? "default" : "outline"}
                  className="flex-1 min-h-12"
                  onClick={() => setCameraActive(!cameraActive)}
                >
                  {cameraActive ? (
                    <>
                      <CameraOff className="mr-2 size-5" />
                      Arreter la camera
                    </>
                  ) : (
                    <>
                      <Camera className="mr-2 size-5" />
                      Scanner un QR
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="min-h-12"
                  onClick={() => setShowSearch(!showSearch)}
                >
                  <Search className="size-5" />
                </Button>
              </div>

              {/* Manual search */}
              {showSearch && (
                <Command className="rounded-lg border">
                  <CommandInput placeholder="Rechercher par nom ou SKU..." />
                  <CommandList className="max-h-48">
                    <CommandEmpty>Aucun produit trouve</CommandEmpty>
                    <CommandGroup>
                      {products.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={`${p.name} ${p.sku}`}
                          onSelect={() => handleAddManual(p.id)}
                          className="flex items-center gap-3"
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
                              {p.sku && <span className="font-mono">{p.sku} - </span>}
                              Stock: {p.stock_current}
                            </p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              )}

              {/* Scanned products list */}
              {selectedProducts.length > 0 && (
                <ScrollArea className="max-h-48 rounded-md border">
                  <div className="space-y-2 p-3">
                    {selectedProducts.map((product) => (
                      <div
                        key={product.productId}
                        className="flex items-center gap-3 rounded-lg border p-2"
                      >
                        <ProductIconDisplay
                          iconName={product.icon_name}
                          iconColor={product.icon_color}
                          imageUrl={product.image_url}
                          size="md"
                          className="shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{product.name}</p>
                          {product.sku && (
                            <p className="text-xs font-mono text-muted-foreground">
                              {product.sku}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-8"
                            onClick={() =>
                              handleQuantityChange(product.productId, product.quantity - 1)
                            }
                            disabled={product.quantity <= 1}
                          >
                            <Minus className="size-4" />
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            max={product.stock_current ?? 0}
                            value={product.quantity}
                            onChange={(e) =>
                              handleQuantityChange(
                                product.productId,
                                parseInt(e.target.value) || 1
                              )
                            }
                            className="w-12 text-center h-8 px-1"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-8"
                            onClick={() =>
                              handleQuantityChange(product.productId, product.quantity + 1)
                            }
                            disabled={product.quantity >= (product.stock_current ?? 0)}
                          >
                            <Plus className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveProduct(product.productId)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {selectedProducts.length === 0 && !showSearch && !cameraActive && (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Scannez un QR code ou recherchez un produit pour commencer
                  </p>
                </div>
              )}
            </div>

            {/* Sticky footer */}
            <DrawerFooter className="border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {selectedProducts.length > 0
                    ? `${selectedProducts.length} produit(s), ${totalItems} item(s)`
                    : "Aucun produit"}
                </span>
                <Button
                  className="min-h-12 px-8"
                  disabled={selectedProducts.length === 0 || isSubmitting}
                  onClick={handleSubmit}
                >
                  {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Enregistrer
                </Button>
              </div>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
