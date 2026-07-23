"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Loader2,
  Minus,
  Plus,
  ArrowRight,
  Search,
  AlertTriangle,
  ChevronDown,
  Check,
} from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useProducts, useTechnicians } from "@/hooks/queries";
import { useCreateStockExit } from "@/hooks/mutations";
import ProductIconDisplay from "@/components/product-icon-display";
import { maxSingleOrgStock, pickExitSource, type OrgStock } from "@/lib/utils/exit-source";
import { cn } from "@/lib/utils";

const ExitSchema = z.object({
  exit_type: z.enum(["exit_technician", "exit_anonymous"]),
  product_id: z.string().min(1, "Sélectionnez un produit"),
  technician_id: z.string().optional(),
  quantity: z.number().min(1, "Minimum 1"),
  // Motif d'une erreur de stock : casse, perte, vol. « Erreur stock » nomme la
  // nature, jamais la cause — sans lui, la ligne ne s'explique plus, et rien ne
  // s'affiche sur le detail du mouvement.
  note: z.string().optional(),
});

type ExitValues = z.infer<typeof ExitSchema>;

interface StockExitModalProps {
  open: boolean;
  onClose: () => void;
  productId?: string | null;
}

export default function StockExitModal({ open, onClose, productId }: StockExitModalProps) {
  const { currentOrganization, organizations } = useOrganizationStore();
  // Le stock montre est le cumul : la sortie ne part plus de la societe
  // affichee en haut de l'application mais de celle qui en a le moins. Afficher
  // le stock d'une seule societe ferait donc mentir la ligne « 4 » sur un
  // produit dont l'autre detient douze unites.
  const { data: productsResult } = useProducts({
    organizationId: currentOrganization?.id,
    stockScope: "all",
  });
  const { data: technicians = [] } = useTechnicians(currentOrganization?.id);
  const products = productsResult?.products || [];
  const createExit = useCreateStockExit();
  const [productSearch, setProductSearch] = useState("");
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
  const [techPopoverOpen, setTechPopoverOpen] = useState(false);
  const [techSearch, setTechSearch] = useState("");

  const form = useForm<ExitValues>({
    resolver: zodResolver(ExitSchema),
    defaultValues: {
      exit_type: "exit_technician",
      product_id: productId || "",
      technician_id: "",
      quantity: 1,
      note: "",
    },
  });

  const watchedProductId = form.watch("product_id");
  const exitType = form.watch("exit_type");
  const quantity = form.watch("quantity");
  const selectedProduct = products.find((p) => p.id === watchedProductId);

  // ─── Societe debitee ────────────────────────────────────
  // Regle metier : on puise chez celle qui en a le moins. Elle se recalcule a
  // chaque unite — passer de 4 a 8 peut faire basculer la sortie sur l'autre
  // societe, une sortie ne se decoupant jamais entre les deux.
  const orgStock: OrgStock[] = useMemo(() => {
    if (!selectedProduct) return [];
    return organizations.flatMap((org) => {
      const row = selectedProduct.product_organization_stock?.find(
        (x) => x.organization_id === org.id
      );
      return row ? [{ id: org.id, name: org.name, stock: row.stock_current }] : [];
    });
  }, [selectedProduct, organizations]);

  // L'outillage n'a pas de ventilation par societe : sans ligne a comparer, la
  // regle ne s'applique pas et l'on retombe sur la societe courante.
  const exitSource = useMemo(() => {
    const picked = pickExitSource(orgStock, quantity || 1);
    if (picked) return picked;
    if (!currentOrganization) return null;
    return {
      id: currentOrganization.id,
      name: currentOrganization.name,
      stock: selectedProduct?.stock_current ?? 0,
    };
  }, [orgStock, quantity, currentOrganization, selectedProduct]);

  // Le stock de la societe debitee, et non le cumul : c'est lui qui borne la
  // saisie. Le cumul laisserait demander dix unites reparties six et quatre,
  // qu'aucune societe ne peut fournir seule.
  const stockAvailable = exitSource?.stock ?? 0;
  const stockCeiling = orgStock.length > 0 ? maxSingleOrgStock(orgStock) : stockAvailable;
  const stockAfter = stockAvailable - (quantity || 0);

  useEffect(() => {
    if (open) {
      setProductSearch("");
      setTechSearch("");
      setShowProductSearch(!productId);
      form.reset({
        exit_type: "exit_technician",
        product_id: productId || "",
        technician_id: "",
        quantity: 1,
        note: "",
      });
    }
  }, [open]);

  const filteredTechnicians = useMemo(() => {
    if (!techSearch) return technicians;
    const q = techSearch.toLowerCase();
    return technicians.filter((t) => `${t.first_name} ${t.last_name}`.toLowerCase().includes(q));
  }, [technicians, techSearch]);

  const selectedTechnician = technicians.find((t) => t.id === form.watch("technician_id"));

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products.slice(0, 6);
    const q = productSearch.toLowerCase();
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
      .slice(0, 6);
  }, [products, productSearch]);

  const onSubmit = (data: ExitValues) => {
    if (!exitSource) return;

    if (selectedProduct && data.quantity > exitSource.stock) {
      toast.error(`${exitSource.name} n'en a que ${exitSource.stock}`);
      return;
    }

    if (data.exit_type === "exit_technician" && !data.technician_id) {
      toast.error("Sélectionnez un technicien");
      return;
    }

    createExit.mutate(
      {
        organizationId: exitSource.id,
        productId: data.product_id,
        quantity: data.quantity,
        type: data.exit_type,
        technicianId: data.exit_type === "exit_technician" ? data.technician_id : undefined,
        // Le motif ne concerne que l'erreur de stock : une sortie technicien a
        // deja son destinataire pour explication.
        note: data.exit_type === "exit_anonymous" ? data.note?.trim() || undefined : undefined,
      },
      {
        onSuccess: () => {
          // La societe est nommee : elle n'a pas ete choisie, c'est la regle
          // qui l'a designee.
          toast.success(
            `−${data.quantity} ${selectedProduct?.name ?? "produit"} — ${exitSource.name}`
          );
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
            {/* Motif — toggle simple */}
            <FormField
              control={form.control}
              name="exit_type"
              render={({ field }) => (
                <FormItem className="px-5 py-3 border-t">
                  <div className="flex rounded-lg border bg-muted/30 p-0.5">
                    <button
                      type="button"
                      onClick={() => field.onChange("exit_technician")}
                      className={cn(
                        "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all",
                        field.value === "exit_technician"
                          ? "bg-card shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Technicien
                    </button>
                    <button
                      type="button"
                      onClick={() => field.onChange("exit_anonymous")}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all",
                        field.value === "exit_anonymous"
                          ? "bg-card shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <AlertTriangle className="size-3.5" />
                      Perte ou erreur
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
                    <Popover open={techPopoverOpen} onOpenChange={setTechPopoverOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors bg-white dark:bg-card",
                            !field.value && "text-foreground/70"
                          )}
                        >
                          <span className="flex-1 text-sm truncate">
                            {selectedTechnician
                              ? `${selectedTechnician.first_name} ${selectedTechnician.last_name}`
                              : "Choisir un technicien"}
                          </span>
                          <ChevronDown className="size-4 shrink-0 opacity-50" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl overflow-hidden"
                        sideOffset={4}
                      >
                        {technicians.length > 5 && (
                          <div className="p-2 border-b">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                              <Input
                                placeholder="Rechercher..."
                                value={techSearch}
                                onChange={(e) => setTechSearch(e.target.value)}
                                className="pl-8 h-8 text-sm bg-white dark:bg-card"
                                autoFocus
                              />
                            </div>
                          </div>
                        )}
                        <div className="max-h-48 overflow-y-auto p-1">
                          {filteredTechnicians.length === 0 ? (
                            <p className="py-3 text-center text-xs text-muted-foreground">
                              Aucun technicien
                            </p>
                          ) : (
                            filteredTechnicians.map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                  field.onChange(t.id);
                                  setTechPopoverOpen(false);
                                  setTechSearch("");
                                }}
                                className={cn(
                                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                                  t.id === field.value
                                    ? "bg-primary/10 font-medium"
                                    : "hover:bg-muted/60"
                                )}
                              >
                                <span className="flex-1 text-sm truncate">
                                  {t.first_name} {t.last_name}
                                </span>
                                {t.id === field.value && (
                                  <Check className="size-3.5 shrink-0 text-primary" />
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
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
                  <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        disabled={!!productId}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors",
                          selectedProduct
                            ? "bg-white dark:bg-card"
                            : "bg-white dark:bg-card text-foreground/70"
                        )}
                      >
                        {selectedProduct ? (
                          <>
                            <ProductIconDisplay
                              iconName={selectedProduct.icon_name}
                              iconColor={selectedProduct.icon_color}
                              imageUrl={selectedProduct.image_url}
                              size="sm"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{selectedProduct.name}</p>
                            </div>
                            {/* Le cumul des deux societes : c'est ce que l'on
                                possede. La societe qui fournira est dite juste
                                en dessous, elle n'a pas sa place ici. */}
                            <div className="text-right shrink-0">
                              <p
                                className={cn(
                                  "text-sm font-semibold tabular-nums",
                                  (selectedProduct.stock_current ?? 0) === 0 && "text-destructive"
                                )}
                              >
                                {selectedProduct.stock_current ?? 0}
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <Search className="size-3.5 shrink-0" />
                            <span className="text-sm">Choisir un produit...</span>
                          </>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl overflow-hidden"
                      sideOffset={4}
                    >
                      <div className="p-2 border-b">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                          <Input
                            placeholder="Rechercher un produit..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className="pl-8 h-8 text-sm bg-white dark:bg-card"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto p-1">
                        {filteredProducts.length === 0 ? (
                          <p className="py-3 text-center text-xs text-muted-foreground">
                            Aucun resultat
                          </p>
                        ) : (
                          filteredProducts.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                field.onChange(p.id);
                                setProductPopoverOpen(false);
                                setProductSearch("");
                              }}
                              className={cn(
                                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                                p.id === watchedProductId
                                  ? "bg-primary/10 font-medium"
                                  : "hover:bg-muted/60"
                              )}
                            >
                              <ProductIconDisplay
                                iconName={p.icon_name}
                                iconColor={p.icon_color}
                                imageUrl={p.image_url}
                                size="sm"
                              />
                              <span className="flex-1 text-sm truncate">{p.name}</span>
                              <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                                {p.stock_current ?? 0}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Qui est debite. L'utilisateur ne l'a pas choisi : la regle
                      l'a designe. Le taire reviendrait a modifier un stock sans
                      dire lequel — et le sélecteur de societe en haut de page
                      ferait croire que c'est lui qui decide. */}
                  {selectedProduct && exitSource && orgStock.length > 0 && (
                    <div className="mt-2 flex items-baseline justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
                      <span className="text-xs text-muted-foreground">
                        Sortie de{" "}
                        <span className="font-medium text-foreground">{exitSource.name}</span>
                        <span className="text-muted-foreground"> — celle qui en a le moins</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {orgStock.map((o) => `${o.name} ${o.stock}`).join(" · ")}
                      </span>
                    </div>
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
                        max={stockCeiling || undefined}
                        className="w-20 h-12 text-center text-2xl font-semibold bg-white dark:bg-card focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        {...field}
                        onChange={(e) =>
                          field.onChange(
                            Math.min(parseInt(e.target.value) || 1, stockCeiling || 9999)
                          )
                        }
                      />
                    </FormControl>
                    <button
                      type="button"
                      onClick={() =>
                        field.onChange(Math.min((field.value || 1) + 1, stockCeiling || 9999))
                      }
                      className="flex size-10 items-center justify-center rounded-full border bg-white dark:bg-card hover:bg-muted transition-colors"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                  {/* Stock impact — celui de la societe debitee, pas le cumul :
                      c'est le seul qui bouge. */}
                  {selectedProduct && (
                    <p className="text-center text-xs text-muted-foreground tabular-nums mt-1">
                      {orgStock.length > 0 && exitSource && (
                        <span className="mr-1.5 tracking-wide">{exitSource.name}</span>
                      )}
                      {stockAvailable}
                      <ArrowRight className="inline size-3 mx-1" />
                      <span
                        className={cn(
                          "font-medium",
                          stockAfter <= 0
                            ? "text-destructive"
                            : stockAfter <= (selectedProduct.stock_min ?? 0)
                              ? "text-orange-500"
                              : "text-foreground"
                        )}
                      >
                        {Math.max(0, stockAfter)}
                      </span>
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Motif — seulement pour une erreur de stock. Une sortie technicien
                s'explique par son destinataire ; une casse, une perte, un vol
                n'ont pas d'autre trace que ce champ, et c'est lui qu'on relit
                sur le detail du mouvement. */}
            {exitType === "exit_anonymous" && (
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem className="border-t px-5 py-3">
                    <span className="text-sm font-medium">Motif</span>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="Cassé, perdu, volé, erreur de saisie…"
                        className="mt-1 bg-white dark:bg-card"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Submit */}
            <div className="px-5 pt-2 pb-5">
              <Button
                type="submit"
                disabled={createExit.isPending || stockCeiling === 0}
                variant="default"
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
