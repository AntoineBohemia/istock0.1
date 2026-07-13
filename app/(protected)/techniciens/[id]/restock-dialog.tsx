"use client";

import { useState, useMemo, useCallback } from "react";
import { Loader2, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RestockItem } from "@/lib/supabase/queries/inventory";
import { useAvailableProductsForRestock } from "@/hooks/queries";
import { useAddToTechnicianInventory } from "@/hooks/mutations";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import ProductIconDisplay from "@/components/product-icon-display";

interface RestockDialogProps {
  technicianId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

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

export default function RestockDialog({
  technicianId,
  open,
  onOpenChange,
  onSuccess,
}: RestockDialogProps) {
  const { currentOrganization } = useOrganizationStore();
  const { data: products = [], isLoading } = useAvailableProductsForRestock(
    currentOrganization?.id
  );
  const addToInventoryMutation = useAddToTechnicianInventory();
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const isSubmitting = addToInventoryMutation.isPending;

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setSelectedProducts([]);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  const selectedIds = useMemo(
    () => new Set(selectedProducts.map((p) => p.productId)),
    [selectedProducts]
  );

  const availableProducts = useMemo(
    () => products.filter((p) => !selectedIds.has(p.id)),
    [products, selectedIds]
  );

  const handleAddProduct = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product || selectedIds.has(productId)) return;

    setSelectedProducts((prev) => [
      ...prev,
      {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        icon_name: product.icon_name,
        icon_color: product.icon_color,
        image_url: product.image_url,
        stock_current: product.stock_current,
        quantity: 1,
      },
    ]);
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    setSelectedProducts((prev) =>
      prev.map((p) => {
        if (p.productId !== productId) return p;
        const maxQuantity = p.stock_current ?? 0;
        return { ...p, quantity: Math.max(1, Math.min(quantity, maxQuantity)) };
      })
    );
  };

  const handleRemoveProduct = (productId: string) => {
    setSelectedProducts((prev) => prev.filter((p) => p.productId !== productId));
  };

  const handleSubmit = () => {
    if (selectedProducts.length === 0) {
      toast.error("Sélectionnez au moins un produit");
      return;
    }

    const items: RestockItem[] = selectedProducts.map((p) => ({
      productId: p.productId,
      quantity: p.quantity,
    }));

    addToInventoryMutation.mutate(
      { technicianId, items },
      {
        onSuccess: () => {
          toast.success("Réapprovisionnement effectué");
          handleOpenChange(false);
          onSuccess();
        },
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : "Erreur lors du réapprovisionnement"
          );
        },
      }
    );
  };

  const totalItems = selectedProducts.reduce((sum, p) => sum + p.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm gap-0 p-0 flex flex-col max-h-[85vh]">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-semibold">Réapprovisionner technicien</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Ajouter un produit */}
            <div className="px-5 py-3 border-t">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) handleAddProduct(e.target.value);
                }}
                disabled={availableProducts.length === 0}
                className="border-input bg-white dark:bg-card text-sm flex h-9 w-full rounded-md border px-3 py-1.5 shadow-xs outline-none focus:border-foreground/30 focus:ring-foreground/10 focus:ring-[3px]"
              >
                <option value="" disabled>
                  {availableProducts.length === 0
                    ? "Tous les produits ajoutés"
                    : "Ajouter un produit..."}
                </option>
                {availableProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.stock_current ?? 0} dispo)
                  </option>
                ))}
              </select>
            </div>

            {/* Selected products */}
            <div className="flex-1 min-h-0 overflow-y-auto border-t">
              {selectedProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center px-5">
                  <p className="text-sm text-muted-foreground">
                    Sélectionnez des produits ci-dessus
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {selectedProducts.map((product) => (
                    <div key={product.productId} className="flex items-center gap-3 px-5 py-3">
                      <ProductIconDisplay
                        iconName={product.icon_name}
                        iconColor={product.icon_color}
                        imageUrl={product.image_url}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{product.name}</p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          {product.stock_current ?? 0} en stock
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            handleQuantityChange(product.productId, product.quantity - 1)
                          }
                          disabled={product.quantity <= 1}
                          className="flex size-7 items-center justify-center rounded-full border bg-white dark:bg-card hover:bg-muted transition-colors disabled:opacity-30"
                        >
                          <Minus className="size-3" />
                        </button>
                        <Input
                          type="number"
                          min={1}
                          max={product.stock_current ?? 0}
                          value={product.quantity}
                          onChange={(e) =>
                            handleQuantityChange(product.productId, parseInt(e.target.value) || 1)
                          }
                          className="w-10 h-7 text-center text-sm font-semibold px-0 bg-white dark:bg-card [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleQuantityChange(product.productId, product.quantity + 1)
                          }
                          disabled={product.quantity >= (product.stock_current ?? 0)}
                          className="flex size-7 items-center justify-center rounded-full border bg-white dark:bg-card hover:bg-muted transition-colors disabled:opacity-30"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(product.productId)}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 px-5 py-4 border-t">
              <p className="flex-1 text-sm text-muted-foreground tabular-nums">
                {selectedProducts.length > 0 && (
                  <>
                    <span className="font-semibold text-foreground">{totalItems}</span> unité
                    {totalItems > 1 ? "s" : ""}
                  </>
                )}
              </p>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
                className="h-10 bg-white dark:bg-card"
              >
                Annuler
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || selectedProducts.length === 0}
                className="h-10"
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Valider
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
