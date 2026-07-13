"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Minus, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useProducts, useOrganizations } from "@/hooks/queries";
import { useCreateStockEntry } from "@/hooks/mutations";
import ProductIconDisplay from "@/components/product-icon-display";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const EntrySchema = z.object({
  organization_id: z.string().min(1, "Sélectionnez une organisation"),
  product_id: z.string().min(1, "Sélectionnez un produit"),
  quantity: z.number().min(1, "Minimum 1"),
  unit_price: z.string().optional(),
});

type EntryValues = z.infer<typeof EntrySchema>;

interface StockEntryModalProps {
  open: boolean;
  onClose: () => void;
  productId?: string | null;
}

export default function StockEntryModal({ open, onClose, productId }: StockEntryModalProps) {
  const { currentOrganization } = useOrganizationStore();
  const { data: userOrgs } = useOrganizations();
  const { data: productsResult } = useProducts({ organizationId: currentOrganization?.id });
  const products = productsResult?.products || [];
  const createEntry = useCreateStockEntry();
  const isMultiOrg = (userOrgs?.length ?? 0) > 1;
  const [priceEditing, setPriceEditing] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [showProductSearch, setShowProductSearch] = useState(false);

  const form = useForm<EntryValues>({
    resolver: zodResolver(EntrySchema),
    defaultValues: {
      organization_id: "",
      product_id: productId || "",
      quantity: 1,
      unit_price: "",
    },
  });

  const watchedProductId = form.watch("product_id");
  const quantity = form.watch("quantity");
  const unitPriceStr = form.watch("unit_price");
  const selectedProduct = products.find((p) => p.id === watchedProductId);
  const unitPrice = unitPriceStr ? parseFloat(unitPriceStr) : 0;
  const total = (quantity || 0) * unitPrice;

  useEffect(() => {
    if (open) {
      setPriceEditing(false);
      setProductSearch("");
      setShowProductSearch(!productId);
      form.reset({
        organization_id: isMultiOrg ? "" : (userOrgs?.[0]?.id ?? ""),
        product_id: productId || "",
        quantity: 1,
        unit_price: "",
      });
    }
  }, [open]);

  useEffect(() => {
    if (selectedProduct?.price != null) {
      form.setValue("unit_price", selectedProduct.price.toString());
      setPriceEditing(false);
    }
  }, [selectedProduct?.id, open]);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products.slice(0, 6);
    const q = productSearch.toLowerCase();
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
      .slice(0, 6);
  }, [products, productSearch]);

  const onSubmit = (data: EntryValues) => {
    const price = data.unit_price ? parseFloat(data.unit_price) : undefined;
    createEntry.mutate(
      {
        organizationId: data.organization_id,
        productId: data.product_id,
        quantity: data.quantity,
        unitPrice: price,
      },
      {
        onSuccess: () => {
          toast.success(`+${data.quantity} ${selectedProduct?.name ?? "produit"} entré en stock`);
          onClose();
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Erreur");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-semibold">Entrée de stock</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {/* Organisation */}
            {isMultiOrg && (
              <FormField
                control={form.control}
                name="organization_id"
                render={({ field }) => (
                  <FormItem className="px-5 py-3 border-t">
                    <div className="grid grid-cols-2 gap-2">
                      {userOrgs?.map((org) => (
                        <button
                          key={org.id}
                          type="button"
                          onClick={() => field.onChange(org.id)}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg border bg-white dark:bg-card px-3 py-2.5 text-sm font-medium transition-all",
                            field.value === org.id
                              ? "border-foreground text-foreground"
                              : "border-border text-muted-foreground hover:border-foreground/30"
                          )}
                        >
                          <Checkbox
                            checked={field.value === org.id}
                            className="rounded-md pointer-events-none data-checked:bg-foreground data-checked:border-foreground"
                            tabIndex={-1}
                          />
                          {org.name}
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Produit */}
            <FormField
              control={form.control}
              name="product_id"
              render={({ field }) => (
                <FormItem className="border-t">
                  {selectedProduct && !showProductSearch ? (
                    <button
                      type="button"
                      onClick={!productId ? () => { setShowProductSearch(true); setProductSearch(""); } : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 px-5 py-3 text-left",
                        !productId && "hover:bg-muted/40 transition-colors"
                      )}
                    >
                      <ProductIconDisplay
                        iconName={selectedProduct.icon_name}
                        iconColor={selectedProduct.icon_color}
                        imageUrl={selectedProduct.image_url}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{selectedProduct.name}</p>
                        {selectedProduct.sku && (
                          <p className="text-[11px] text-muted-foreground font-mono">{selectedProduct.sku}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold tabular-nums">{selectedProduct.stock_current ?? 0}</p>
                        <p className="text-[10px] text-muted-foreground">en stock</p>
                      </div>
                    </button>
                  ) : (
                    <div className="px-5 py-3 space-y-1">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Produit..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          className="pl-8 h-8 text-sm bg-white dark:bg-card"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {filteredProducts.length === 0 ? (
                          <p className="py-2 text-center text-xs text-muted-foreground">Aucun résultat</p>
                        ) : (
                          filteredProducts.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                field.onChange(p.id);
                                setShowProductSearch(false);
                                setProductSearch("");
                              }}
                              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/60 transition-colors text-left"
                            >
                              <ProductIconDisplay iconName={p.icon_name} iconColor={p.icon_color} imageUrl={p.image_url} size="sm" />
                              <span className="flex-1 text-sm truncate">{p.name}</span>
                              <span className="text-xs tabular-nums text-muted-foreground shrink-0">{p.stock_current ?? 0}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                  <FormMessage className="px-5" />
                </FormItem>
              )}
            />

            {/* Quantité */}
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem className="border-t px-5 py-4">
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => field.onChange(Math.max(1, (field.value || 1) - 1))}
                      className="flex size-10 items-center justify-center rounded-full border bg-white dark:bg-card hover:bg-muted transition-colors"
                    >
                      <Minus className="size-4" />
                    </button>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        className="w-20 h-12 text-center text-2xl font-semibold bg-white dark:bg-card focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <button
                      type="button"
                      onClick={() => field.onChange((field.value || 1) + 1)}
                      className="flex size-10 items-center justify-center rounded-full border bg-white dark:bg-card hover:bg-muted transition-colors"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Prix */}
            <FormField
              control={form.control}
              name="unit_price"
              render={({ field }) => (
                <FormItem className="border-t px-5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Prix HT</span>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="—"
                          className={cn(
                            "w-24 h-8 text-right text-sm border-0 bg-transparent focus-visible:ring-0 pr-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                            !priceEditing && "text-muted-foreground"
                          )}
                          disabled={!priceEditing}
                          {...field}
                        />
                      </FormControl>
                      <span className="text-sm text-muted-foreground">€</span>
                      <button
                        type="button"
                        onClick={() => setPriceEditing(!priceEditing)}
                        className="text-xs text-primary hover:underline ml-1"
                      >
                        {priceEditing ? "OK" : "Modifier"}
                      </button>
                    </div>
                  </div>
                  {total > 0 && (
                    <p className="text-right text-xs text-muted-foreground tabular-nums mt-1">
                      {quantity} × {unitPrice.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € = <span className="font-medium text-foreground">{total.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</span>
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit */}
            <div className="px-5 pt-2 pb-5">
              <Button
                type="submit"
                disabled={createEntry.isPending}
                className="w-full h-10 rounded-lg"
              >
                {createEntry.isPending && <Loader2 className="size-4 animate-spin" />}
                Entrer en stock
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
