"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDownToLine, Loader2, Minus, Plus, Lock, Unlock } from "lucide-react";
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
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useProducts, useOrganizations } from "@/hooks/queries";
import { useCreateStockEntry } from "@/hooks/mutations";
import ProductIconDisplay from "@/components/product-icon-display";
import { cn } from "@/lib/utils";

const EntrySchema = z.object({
  organization_id: z.string().min(1, "Sélectionnez une organisation"),
  product_id: z.string().min(1, "Sélectionnez un produit"),
  quantity: z.number().min(1, "Minimum 1"),
  unit_price: z.string().optional(),
  notes: z.string().optional(),
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
  const [priceLocked, setPriceLocked] = useState(true);

  const form = useForm<EntryValues>({
    resolver: zodResolver(EntrySchema),
    defaultValues: {
      organization_id: "",
      product_id: productId || "",
      quantity: 1,
      unit_price: "",
      notes: "",
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
      setPriceLocked(true);
      form.reset({
        organization_id: isMultiOrg ? "" : (userOrgs?.[0]?.id ?? ""),
        product_id: productId || "",
        quantity: 1,
        unit_price: "",
        notes: "",
      });
    }
  }, [open]);

  // Pre-fill price from product whenever product changes
  useEffect(() => {
    if (selectedProduct?.price != null) {
      form.setValue("unit_price", selectedProduct.price.toString());
      setPriceLocked(true);
    }
  }, [selectedProduct?.id]);

  const onSubmit = (data: EntryValues) => {
    const price = data.unit_price ? parseFloat(data.unit_price) : undefined;
    createEntry.mutate(
      {
        organizationId: data.organization_id,
        productId: data.product_id,
        quantity: data.quantity,
        unitPrice: price,
        notes: data.notes,
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <ArrowDownToLine className="size-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Entrée de stock</DialogTitle>
              <p className="text-sm text-muted-foreground">Ajouter des produits au stock</p>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Organisation pills */}
            {isMultiOrg && (
              <FormField
                control={form.control}
                name="organization_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organisation</FormLabel>
                    <div className="flex gap-2">
                      {userOrgs?.map((org) => (
                        <button
                          key={org.id}
                          type="button"
                          onClick={() => field.onChange(org.id)}
                          className={cn(
                            "flex-1 rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-all",
                            field.value === org.id
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/30"
                          )}
                        >
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
                <FormItem>
                  <FormLabel>Produit</FormLabel>
                  {selectedProduct ? (
                    <div
                      className={cn(
                        "flex items-center gap-3 rounded-xl border bg-muted/30 p-3",
                        !productId && "cursor-pointer hover:bg-muted/50 transition-colors"
                      )}
                    >
                      <ProductIconDisplay
                        iconName={selectedProduct.icon_name}
                        iconColor={selectedProduct.icon_color}
                        imageUrl={selectedProduct.image_url}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{selectedProduct.name}</p>
                        {selectedProduct.sku && (
                          <p className="text-xs text-muted-foreground font-mono">{selectedProduct.sku}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-heading font-bold text-lg tabular-nums">
                          {selectedProduct.stock_current ?? 0}
                        </p>
                        <p className="text-[11px] text-muted-foreground">en stock</p>
                      </div>
                      {!productId && (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="absolute inset-0 opacity-0 cursor-pointer" />
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ) : (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choisir un produit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Quantity with +/- buttons + Unit price */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantité</FormLabel>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => field.onChange(Math.max(1, (field.value || 1) - 1))}
                        className="flex size-9 items-center justify-center rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          className="text-center font-heading font-bold text-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <button
                        type="button"
                        onClick={() => field.onChange((field.value || 1) + 1)}
                        className="flex size-9 items-center justify-center rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prix unitaire HT</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          className={cn("pr-16", priceLocked && "bg-muted/50 text-muted-foreground")}
                          disabled={priceLocked}
                          {...field}
                        />
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          <span className="text-sm text-muted-foreground">€</span>
                          <button
                            type="button"
                            onClick={() => setPriceLocked(!priceLocked)}
                            className={cn(
                              "flex size-7 items-center justify-center rounded-md transition-colors",
                              priceLocked
                                ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                                : "text-primary bg-primary/10"
                            )}
                            title={priceLocked ? "Modifier le prix" : "Verrouiller le prix"}
                          >
                            {priceLocked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
                          </button>
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Total */}
            {total > 0 && (
              <div className="rounded-xl bg-primary/5 border border-primary/10 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {quantity} × {unitPrice.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                </span>
                <span className="font-heading font-bold text-lg tabular-nums text-primary">
                  {total.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                </span>
              </div>
            )}

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Optionnel..." rows={2} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Submit */}
            <Button
              type="submit"
              disabled={createEntry.isPending}
              className="w-full h-11"
            >
              {createEntry.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowDownToLine className="size-4" />
              )}
              Entrer en stock
            </Button>
          </form>
        </Form>
      </DialogContent>

    </Dialog>
  );
}
