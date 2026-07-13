"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Minus, Plus, ArrowRight, Search } from "lucide-react";
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
import { useProducts, useTechnicians } from "@/hooks/queries";
import { useCreateStockExit } from "@/hooks/mutations";
import ProductIconDisplay from "@/components/product-icon-display";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const ExitSchema = z.object({
  exit_type: z.enum(["exit_technician", "exit_anonymous"]),
  product_id: z.string().min(1, "Sélectionnez un produit"),
  technician_id: z.string().optional(),
  quantity: z.number().min(1, "Minimum 1"),
});

type ExitValues = z.infer<typeof ExitSchema>;

interface StockExitModalProps {
  open: boolean;
  onClose: () => void;
  productId?: string | null;
}

export default function StockExitModal({ open, onClose, productId }: StockExitModalProps) {
  const { currentOrganization } = useOrganizationStore();
  const { data: productsResult } = useProducts({ organizationId: currentOrganization?.id });
  const { data: technicians = [] } = useTechnicians(currentOrganization?.id);
  const products = productsResult?.products || [];
  const createExit = useCreateStockExit();
  const [productSearch, setProductSearch] = useState("");
  const [showProductSearch, setShowProductSearch] = useState(false);

  const form = useForm<ExitValues>({
    resolver: zodResolver(ExitSchema),
    defaultValues: {
      exit_type: "exit_technician",
      product_id: productId || "",
      technician_id: "",
      quantity: 1,
    },
  });

  const watchedProductId = form.watch("product_id");
  const exitType = form.watch("exit_type");
  const quantity = form.watch("quantity");
  const selectedProduct = products.find((p) => p.id === watchedProductId);
  const stockAvailable = selectedProduct?.stock_current ?? 0;
  const stockAfter = stockAvailable - (quantity || 0);

  useEffect(() => {
    if (open) {
      setProductSearch("");
      setShowProductSearch(!productId);
      form.reset({
        exit_type: "exit_technician",
        product_id: productId || "",
        technician_id: "",
        quantity: 1,
      });
    }
  }, [open]);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products.slice(0, 6);
    const q = productSearch.toLowerCase();
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
      .slice(0, 6);
  }, [products, productSearch]);

  const onSubmit = (data: ExitValues) => {
    if (!currentOrganization) return;

    if (selectedProduct && data.quantity > stockAvailable) {
      toast.error(`Stock insuffisant (${stockAvailable} disponible)`);
      return;
    }

    if (data.exit_type === "exit_technician" && !data.technician_id) {
      toast.error("Sélectionnez un technicien");
      return;
    }

    createExit.mutate(
      {
        organizationId: currentOrganization.id,
        productId: data.product_id,
        quantity: data.quantity,
        type: data.exit_type,
        technicianId: data.exit_type === "exit_technician" ? data.technician_id : undefined,
      },
      {
        onSuccess: () => {
          toast.success(`−${data.quantity} ${selectedProduct?.name ?? "produit"} sorti du stock`);
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
          <DialogTitle className="text-base font-semibold">Sortie de stock</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {/* Motif */}
            <FormField
              control={form.control}
              name="exit_type"
              render={({ field }) => (
                <FormItem className="px-5 py-3 border-t">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => field.onChange("exit_technician")}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border bg-white dark:bg-card px-3 py-2.5 text-sm font-medium transition-all",
                        field.value === "exit_technician"
                          ? "border-foreground text-foreground"
                          : "border-border text-muted-foreground hover:border-foreground/30"
                      )}
                    >
                      <Checkbox
                        checked={field.value === "exit_technician"}
                        className="rounded-md pointer-events-none data-checked:bg-foreground data-checked:border-foreground"
                        tabIndex={-1}
                      />
                      Technicien
                    </button>
                    <button
                      type="button"
                      onClick={() => field.onChange("exit_anonymous")}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border bg-white dark:bg-card px-3 py-2.5 text-sm font-medium transition-all",
                        field.value === "exit_anonymous"
                          ? "border-foreground text-foreground"
                          : "border-border text-muted-foreground hover:border-foreground/30"
                      )}
                    >
                      <Checkbox
                        checked={field.value === "exit_anonymous"}
                        className="rounded-md pointer-events-none data-checked:bg-foreground data-checked:border-foreground"
                        tabIndex={-1}
                      />
                      Erreur stock
                    </button>
                  </div>
                </FormItem>
              )}
            />

            {/* Technicien */}
            {exitType === "exit_technician" && (
              <FormField
                control={form.control}
                name="technician_id"
                render={({ field }) => (
                  <FormItem className="border-t px-5 py-3">
                    <FormControl>
                      <select
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value)}
                        className="border-input bg-white dark:bg-card text-sm flex h-9 w-full rounded-md border px-3 py-1.5 shadow-xs outline-none focus:border-foreground/30 focus:ring-foreground/10 focus:ring-[3px]"
                      >
                        <option value="" disabled>Choisir un technicien</option>
                        {technicians.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.first_name} {t.last_name}
                          </option>
                        ))}
                      </select>
                    </FormControl>
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
                        <p className={cn(
                          "text-sm font-semibold tabular-nums",
                          stockAvailable === 0 && "text-destructive"
                        )}>
                          {stockAvailable}
                        </p>
                        <p className="text-[10px] text-muted-foreground">dispo</p>
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
                        max={stockAvailable || undefined}
                        className="w-20 h-12 text-center text-2xl font-semibold bg-white dark:bg-card focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        {...field}
                        onChange={(e) =>
                          field.onChange(Math.min(parseInt(e.target.value) || 1, stockAvailable || 9999))
                        }
                      />
                    </FormControl>
                    <button
                      type="button"
                      onClick={() =>
                        field.onChange(Math.min((field.value || 1) + 1, stockAvailable || 9999))
                      }
                      className="flex size-10 items-center justify-center rounded-full border bg-white dark:bg-card hover:bg-muted transition-colors"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                  {/* Stock impact */}
                  {selectedProduct && (
                    <p className="text-center text-xs text-muted-foreground tabular-nums mt-1">
                      {stockAvailable}
                      <ArrowRight className="inline size-3 mx-1" />
                      <span className={cn(
                        "font-medium",
                        stockAfter <= 0 ? "text-destructive" : stockAfter <= (selectedProduct.stock_min ?? 0) ? "text-orange-500" : "text-foreground"
                      )}>
                        {Math.max(0, stockAfter)}
                      </span>
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
                disabled={createExit.isPending || stockAvailable === 0}
                variant="destructive"
                className="w-full h-10 rounded-lg"
              >
                {createExit.isPending && <Loader2 className="size-4 animate-spin" />}
                Sortir du stock
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
