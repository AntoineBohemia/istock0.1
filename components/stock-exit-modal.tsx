"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpFromLine, Loader2, Minus, Plus, HardHat, AlertTriangle } from "lucide-react";
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
import { useProducts, useTechnicians } from "@/hooks/queries";
import { useCreateStockExit } from "@/hooks/mutations";
import ProductIconDisplay from "@/components/product-icon-display";
import { cn } from "@/lib/utils";

const ExitSchema = z.object({
  exit_type: z.enum(["exit_technician", "exit_anonymous"]),
  product_id: z.string().min(1, "Sélectionnez un produit"),
  technician_id: z.string().optional(),
  quantity: z.number().min(1, "Minimum 1"),
  notes: z.string().optional(),
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

  const form = useForm<ExitValues>({
    resolver: zodResolver(ExitSchema),
    defaultValues: {
      exit_type: "exit_technician",
      product_id: productId || "",
      technician_id: "",
      quantity: 1,
      notes: "",
    },
  });

  const watchedProductId = form.watch("product_id");
  const exitType = form.watch("exit_type");
  const quantity = form.watch("quantity");
  const selectedProduct = products.find((p) => p.id === watchedProductId);
  const stockAvailable = selectedProduct?.stock_current ?? 0;

  useEffect(() => {
    if (open) {
      form.reset({
        exit_type: "exit_technician",
        product_id: productId || "",
        technician_id: "",
        quantity: 1,
        notes: "",
      });
    }
  }, [open]);

  const onSubmit = (data: ExitValues) => {
    if (!currentOrganization) return;

    if (selectedProduct && data.quantity > stockAvailable) {
      toast.error(`Stock insuffisant (${stockAvailable} disponible)`);
      return;
    }

    createExit.mutate(
      {
        organizationId: currentOrganization.id,
        productId: data.product_id,
        quantity: data.quantity,
        type: data.exit_type,
        technicianId: data.exit_type === "exit_technician" ? data.technician_id : undefined,
        notes: data.notes,
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-critique/10">
              <ArrowUpFromLine className="size-5 text-critique" />
            </div>
            <div>
              <DialogTitle>Sortie de stock</DialogTitle>
              <p className="text-sm text-muted-foreground">Retirer des produits du stock</p>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Type de sortie — card toggle */}
            <FormField
              control={form.control}
              name="exit_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motif</FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => field.onChange("exit_technician")}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border-2 px-3.5 py-3 text-left transition-all",
                        field.value === "exit_technician"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/30"
                      )}
                    >
                      <div
                        className={cn(
                          "flex size-9 items-center justify-center rounded-lg",
                          field.value === "exit_technician"
                            ? "bg-primary/10"
                            : "bg-muted"
                        )}
                      >
                        <HardHat
                          className={cn(
                            "size-4",
                            field.value === "exit_technician"
                              ? "text-primary"
                              : "text-muted-foreground"
                          )}
                        />
                      </div>
                      <div>
                        <p
                          className={cn(
                            "text-sm font-medium",
                            field.value === "exit_technician"
                              ? "text-primary"
                              : "text-muted-foreground"
                          )}
                        >
                          Technicien
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => field.onChange("exit_anonymous")}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border-2 px-3.5 py-3 text-left transition-all",
                        field.value === "exit_anonymous"
                          ? "border-attention bg-attention/5"
                          : "border-border hover:border-attention/30"
                      )}
                    >
                      <div
                        className={cn(
                          "flex size-9 items-center justify-center rounded-lg",
                          field.value === "exit_anonymous"
                            ? "bg-attention/10"
                            : "bg-muted"
                        )}
                      >
                        <AlertTriangle
                          className={cn(
                            "size-4",
                            field.value === "exit_anonymous"
                              ? "text-attention"
                              : "text-muted-foreground"
                          )}
                        />
                      </div>
                      <div>
                        <p
                          className={cn(
                            "text-sm font-medium",
                            field.value === "exit_anonymous"
                              ? "text-attention"
                              : "text-muted-foreground"
                          )}
                        >
                          Erreur stock
                        </p>
                      </div>
                    </button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Technicien */}
            {exitType === "exit_technician" && (
              <FormField
                control={form.control}
                name="technician_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Technicien</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choisir un technicien" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {technicians.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.first_name} {t.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                        <p
                          className={cn(
                            "font-heading font-bold text-lg tabular-nums",
                            stockAvailable === 0 ? "text-critique" : "text-foreground"
                          )}
                        >
                          {stockAvailable}
                        </p>
                        <p className="text-[11px] text-muted-foreground">disponible</p>
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

            {/* Quantity with +/- */}
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
                        max={stockAvailable || undefined}
                        className="text-center font-heading font-bold text-lg max-w-24 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        {...field}
                        onChange={(e) =>
                          field.onChange(
                            Math.min(parseInt(e.target.value) || 1, stockAvailable || 9999)
                          )
                        }
                      />
                    </FormControl>
                    <button
                      type="button"
                      onClick={() =>
                        field.onChange(Math.min((field.value || 1) + 1, stockAvailable || 9999))
                      }
                      className="flex size-9 items-center justify-center rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <Plus className="size-3.5" />
                    </button>
                    <span className="text-sm text-muted-foreground ml-2">
                      / {stockAvailable}
                    </span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

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
              disabled={createExit.isPending || stockAvailable === 0}
              variant="destructive"
              className="w-full h-11"
            >
              {createExit.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUpFromLine className="size-4" />
              )}
              Sortir du stock
            </Button>
          </form>
        </Form>
      </DialogContent>

    </Dialog>
  );
}
