"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, ImageIcon, Plus, Minus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  restockTechnician,
  getAvailableProductsForRestock,
  RestockItem,
} from "@/lib/supabase/queries/inventory";

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
  image_url: string | null;
  stock_current: number;
  quantity: number;
}

export default function RestockDialog({
  technicianId,
  open,
  onOpenChange,
  onSuccess,
}: RestockDialogProps) {
  const [products, setProducts] = useState<
    Array<{
      id: string;
      name: string;
      sku: string | null;
      image_url: string | null;
      stock_current: number;
      stock_max: number;
    }>
  >([]);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      loadProducts();
      setSelectedProducts([]);
    }
  }, [open]);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const data = await getAvailableProductsForRestock();
      setProducts(data);
    } catch (error) {
      toast.error("Erreur lors du chargement des produits");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProduct = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    if (selectedProducts.find((p) => p.productId === productId)) {
      toast.error("Ce produit est déjà dans la liste");
      return;
    }

    setSelectedProducts([
      ...selectedProducts,
      {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        image_url: product.image_url,
        stock_current: product.stock_current,
        quantity: 1,
      },
    ]);
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    const product = selectedProducts.find((p) => p.productId === productId);
    if (!product) return;

    const maxQuantity = product.stock_current;
    const newQuantity = Math.max(1, Math.min(quantity, maxQuantity));

    setSelectedProducts(
      selectedProducts.map((p) =>
        p.productId === productId ? { ...p, quantity: newQuantity } : p
      )
    );
  };

  const handleRemoveProduct = (productId: string) => {
    setSelectedProducts(
      selectedProducts.filter((p) => p.productId !== productId)
    );
  };

  const handleSubmit = async () => {
    if (selectedProducts.length === 0) {
      toast.error("Veuillez sélectionner au moins un produit");
      return;
    }

    setIsSubmitting(true);
    try {
      const items: RestockItem[] = selectedProducts.map((p) => ({
        productId: p.productId,
        quantity: p.quantity,
      }));

      await restockTechnician(technicianId, items);

      toast.success("Restock effectué avec succès");
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur lors du restock"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalItems = selectedProducts.reduce((sum, p) => sum + p.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Restocker le technicien</DialogTitle>
          <DialogDescription>
            Sélectionnez les produits et quantités à attribuer. L&apos;ancien
            inventaire sera archivé et le stock sera décrémenté.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Product selector */}
            <div className="space-y-2">
              <Label>Ajouter un produit</Label>
              <Select onValueChange={handleAddProduct}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un produit" />
                </SelectTrigger>
                <SelectContent>
                  {products
                    .filter(
                      (p) => !selectedProducts.find((sp) => sp.productId === p.id)
                    )
                    .map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        <div className="flex items-center gap-2">
                          <span>{product.name}</span>
                          <Badge variant="outline" className="ml-2">
                            Stock: {product.stock_current}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selected products list */}
            {selectedProducts.length > 0 && (
              <div className="space-y-2">
                <Label>Produits sélectionnés</Label>
                <ScrollArea className="h-64 rounded-md border">
                  <div className="space-y-2 p-4">
                    {selectedProducts.map((product) => (
                      <div
                        key={product.productId}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <figure className="flex size-10 items-center justify-center rounded-lg border bg-muted">
                            {product.image_url ? (
                              <Image
                                src={product.image_url}
                                width={40}
                                height={40}
                                alt={product.name}
                                className="size-full rounded-lg object-cover"
                              />
                            ) : (
                              <ImageIcon className="size-5 text-muted-foreground" />
                            )}
                          </figure>
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Stock disponible: {product.stock_current}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-8"
                            onClick={() =>
                              handleQuantityChange(
                                product.productId,
                                product.quantity - 1
                              )
                            }
                            disabled={product.quantity <= 1}
                          >
                            <Minus className="size-4" />
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            max={product.stock_current}
                            value={product.quantity}
                            onChange={(e) =>
                              handleQuantityChange(
                                product.productId,
                                parseInt(e.target.value) || 1
                              )
                            }
                            className="w-16 text-center"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-8"
                            onClick={() =>
                              handleQuantityChange(
                                product.productId,
                                product.quantity + 1
                              )
                            }
                            disabled={product.quantity >= product.stock_current}
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
              </div>
            )}

            {selectedProducts.length === 0 && (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-muted-foreground">
                  Aucun produit sélectionné. Utilisez le menu ci-dessus pour
                  ajouter des produits.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <div className="flex-1 text-sm text-muted-foreground">
            {selectedProducts.length > 0 && (
              <span>
                {selectedProducts.length} produit(s), {totalItems} item(s) au
                total
              </span>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || selectedProducts.length === 0}
          >
            {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Valider le restock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
