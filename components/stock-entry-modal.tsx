"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Minus, Plus } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useProducts, useOrganizations } from "@/hooks/queries";
import { useCreateStockEntry } from "@/hooks/mutations";

import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";

const today = new Date();
const todayStr = today.toISOString().split("T")[0];
const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);

const EntrySchema = z.object({
  organization_id: z.string().min(1, "Sélectionnez une organisation"),
  product_id: z.string().min(1, "Sélectionnez un produit"),
  quantity: z.number().min(1, "Minimum 1"),
  unit_price: z.string().optional(),
  invoice_reference: z.string().optional(),
  entry_date: z.string().optional(),
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
  const [priceOverridden, setPriceOverridden] = useState(false);

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
      setPriceOverridden(false);
      form.reset({
        organization_id: isMultiOrg ? "" : (userOrgs?.[0]?.id ?? ""),
        product_id: productId || "",
        quantity: 1,
        unit_price: "",
        invoice_reference: "",
        entry_date: "",
      });
    }
  }, [open]);

  const defaultPrice = selectedProduct?.price ?? null;

  useEffect(() => {
    if (selectedProduct?.price != null) {
      form.setValue("unit_price", selectedProduct.price.toString());
      setPriceEditing(false);
      setPriceOverridden(false);
    }
  }, [selectedProduct?.id, open]);

  const onSubmit = (data: EntryValues) => {
    // Only send unitPrice if user explicitly unlocked and changed the price
    // Always send the unit_price — it's the purchase price for this entry, not a product price update
    const price = data.unit_price ? parseFloat(data.unit_price) : undefined;
    createEntry.mutate(
      {
        organizationId: data.organization_id,
        productId: data.product_id,
        quantity: data.quantity,
        supplierId: selectedProduct?.supplier_id ?? undefined,
        unitPrice: price,
        invoiceReference: data.invoice_reference || undefined,
        entryDate: data.entry_date ? new Date(data.entry_date).toISOString() : undefined,
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
                            "flex items-center gap-2.5 rounded-lg border bg-white dark:bg-card px-3 py-2.5 text-sm font-medium transition-all cursor-pointer",
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
                <FormItem className="border-t px-5 py-3">
                  <FormControl>
                    <div className="relative">
                      <select
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                        disabled={!!productId}
                        className={cn(
                          "appearance-none border-input bg-white dark:bg-card text-sm flex h-9 w-full rounded-md border px-3 pr-8 py-1.5 outline-none focus:border-foreground/30 focus:ring-foreground/10 focus:ring-[3px]",
                          !!productId && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <option value="">Sélectionner un produit…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.stock_current ?? 0} en stock)
                          </option>
                        ))}
                      </select>
                      <svg
                        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </div>
                  </FormControl>
                  {selectedProduct && (
                    <p className="text-xs mt-1.5">
                      <span className="text-muted-foreground">Fournisseur : </span>
                      {selectedProduct.supplier?.name ? (
                        <span className="font-medium">{selectedProduct.supplier.name}</span>
                      ) : (
                        <span className="text-attention font-medium">
                          aucun — à renseigner sur la fiche produit
                        </span>
                      )}
                    </p>
                  )}
                  <FormMessage />
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
                      {priceEditing ? (
                        <>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="—"
                              autoFocus
                              className="w-24 h-8 text-right text-sm bg-white dark:bg-card rounded-md border border-input focus-visible:ring-0 focus-visible:border-foreground/30 pr-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              {...field}
                            />
                          </FormControl>
                          <span className="text-sm text-muted-foreground">€</span>
                          <button
                            type="button"
                            onClick={() => {
                              setPriceEditing(false);
                              const currentVal = parseFloat(field.value || "0");
                              if (defaultPrice != null && currentVal !== defaultPrice) {
                                setPriceOverridden(true);
                              } else {
                                setPriceOverridden(false);
                              }
                            }}
                            className="text-xs font-medium text-primary hover:underline ml-1 cursor-pointer"
                          >
                            OK
                          </button>
                        </>
                      ) : (
                        <>
                          <span
                            className={cn(
                              "text-sm tabular-nums",
                              priceOverridden
                                ? "text-foreground font-medium"
                                : "text-muted-foreground"
                            )}
                          >
                            {unitPrice > 0
                              ? unitPrice.toLocaleString("fr-FR", { minimumFractionDigits: 2 })
                              : "—"}
                          </span>
                          <span className="text-sm text-muted-foreground">€</span>
                          {priceOverridden && defaultPrice != null && (
                            <span className="text-xs text-muted-foreground line-through tabular-nums">
                              {defaultPrice.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setPriceEditing(true)}
                            className="text-xs text-primary hover:underline ml-1 cursor-pointer"
                          >
                            {priceOverridden ? "Réajuster" : "Ajuster pour cette entrée"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {priceOverridden && !priceEditing && (
                    <p className="text-right text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                      Prix ajusté pour cette entrée uniquement
                    </p>
                  )}
                  {total > 0 && quantity > 1 && (
                    <p className="text-right text-xs text-muted-foreground tabular-nums mt-1">
                      {quantity} × {unitPrice.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}{" "}
                      € ={" "}
                      <span className="font-medium text-foreground">
                        {total.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                      </span>
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Réf. facture */}
            <FormField
              control={form.control}
              name="invoice_reference"
              render={({ field }) => (
                <FormItem className="border-t px-5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Réf. facture</span>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="FA-2026-001"
                        className="w-40 h-8 text-right text-sm bg-white dark:bg-card rounded-md border border-input focus-visible:ring-0 focus-visible:border-foreground/30 pr-2"
                        {...field}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date d'entrée */}
            <FormField
              control={form.control}
              name="entry_date"
              render={({ field }) => (
                <FormItem className="border-t px-5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Date d'entrée</span>
                    <DatePicker
                      value={field.value ? new Date(field.value) : undefined}
                      onChange={(date) => field.onChange(date?.toISOString().split("T")[0] ?? "")}
                      disabled={{ after: today, before: ninetyDaysAgo }}
                      placeholder="Aujourd'hui"
                      className="h-8 text-sm"
                    />
                  </div>
                  {field.value && field.value !== todayStr && (
                    <p className="text-right text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                      Date antérieure à aujourd'hui
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
