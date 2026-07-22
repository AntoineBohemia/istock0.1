"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Minus, Paperclip, Plus, X } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useProducts, useOrganizations } from "@/hooks/queries";
import { activeOrganizations } from "@/lib/supabase/queries/organizations";
import { useCreateStockEntry } from "@/hooks/mutations";
import { linkMovementToInvoice } from "@/lib/supabase/queries/stock-movements";
import { toEntryTimestamp } from "@/lib/utils/entry-date";
import { attachInvoiceFileToMovement } from "@/lib/supabase/queries/attach-invoice";
import {
  getPurchaseInvoices,
  type PurchaseInvoice,
} from "@/lib/supabase/queries/purchase-invoices";
import NewInvoiceDialog from "@/components/new-invoice-dialog";

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
  const { data: allOrgs } = useOrganizations();
  // Saisie : on ne propose que des societes en activite.
  const userOrgs = activeOrganizations(allOrgs ?? []);
  // L'outillage s'achete comme le reste : il doit figurer dans la liste
  // des produits, meme s'il ne comptera pas dans les totaux.
  const { data: productsResult } = useProducts({
    organizationId: currentOrganization?.id,
    includeEquipment: true,
  });
  const products = productsResult?.products || [];
  const createEntry = useCreateStockEntry();
  const isMultiOrg = (userOrgs?.length ?? 0) > 1;
  const [priceEditing, setPriceEditing] = useState(false);
  const [priceOverridden, setPriceOverridden] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  // Facture jointe directement en PDF, sans passer par la page Factures
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const invoiceInputRef = useRef<HTMLInputElement>(null);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [isLinkingInvoice, setIsLinkingInvoice] = useState(false);

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
      setInvoiceId("");
      form.reset({
        organization_id: isMultiOrg ? "" : (userOrgs?.[0]?.id ?? ""),
        product_id: productId || "",
        quantity: 1,
        unit_price: "",
        entry_date: "",
      });
    }
  }, [open]);

  // Factures disponibles pour rattacher cet achat
  const reloadInvoices = async () => {
    if (!currentOrganization?.id) return;
    try {
      setInvoices(await getPurchaseInvoices(currentOrganization.id));
    } catch {
      // La liste reste vide : on peut toujours créer une facture à la volée
    }
  };

  useEffect(() => {
    if (open) reloadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentOrganization?.id]);

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
        // Date du jour => heure de validation, pas minuit.
        entryDate: toEntryTimestamp(data.entry_date),
      },
      {
        // Le rattachement se fait après création : il a besoin de l'id du mouvement
        onSuccess: async (movement) => {
          const label = `+${data.quantity} ${selectedProduct?.name ?? "produit"} entré en stock`;
          if (!invoiceId && !invoiceFile) {
            toast.success(label);
            onClose();
            return;
          }
          setIsLinkingInvoice(true);
          try {
            if (invoiceFile && currentOrganization?.id) {
              // Le PDF cree la facture et la rattache en une fois
              await attachInvoiceFileToMovement({
                file: invoiceFile,
                movementId: movement.id,
                organizationId: currentOrganization.id,
                // Le fournisseur vient du produit, comme pour le mouvement
                supplierId: selectedProduct?.supplier_id ?? null,
                invoiceDate: data.entry_date || null,
                totalAmount: data.unit_price ? Number(data.unit_price) * data.quantity : null,
              });
            } else {
              await linkMovementToInvoice(movement.id, invoiceId);
            }
            toast.success(`${label} · rattaché à la facture`);
          } catch {
            toast.error("Entrée enregistrée, mais le rattachement à la facture a échoué");
          } finally {
            setIsLinkingInvoice(false);
            onClose();
          }
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Erreur");
        },
      }
    );
  };

  return (
    <>
      {/* La modale s'efface pendant la création de facture pour éviter
          l'empilement — la saisie en cours est conservée. */}
      <Dialog open={open && !newInvoiceOpen} onOpenChange={(o) => !o && onClose()}>
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
                        <span className="text-foreground/70">Fournisseur : </span>
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
                      <span className="text-sm font-medium text-foreground">Prix HT</span>
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
                        {quantity} ×{" "}
                        {unitPrice.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € ={" "}
                        <span className="font-medium text-foreground">
                          {total.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
                        </span>
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Facture — une facture peut couvrir plusieurs achats */}
              <div className="border-t px-5 py-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground shrink-0">Facture</span>
                  <select
                    value={invoiceId}
                    onChange={(e) => {
                      if (e.target.value === "__new__") {
                        setNewInvoiceOpen(true);
                      } else {
                        setInvoiceId(e.target.value);
                        // Un choix dans la liste rend le PDF sans objet
                        if (e.target.value) setInvoiceFile(null);
                      }
                    }}
                    disabled={!!invoiceFile}
                    className="h-8 w-52 rounded-md border border-input bg-white dark:bg-card px-2 text-sm disabled:opacity-50"
                  >
                    <option value="">Aucune facture</option>
                    {invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.reference}
                        {inv.supplier?.name ? ` — ${inv.supplier.name}` : ""}
                      </option>
                    ))}
                    <option value="__new__">+ Nouvelle facture…</option>
                  </select>
                </div>

                {/* Joindre directement le PDF : la facture est creee et
                    rattachee toute seule, sans passer par la page Factures. */}
                <div className="flex items-center justify-end gap-2">
                  <input
                    ref={invoiceInputRef}
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setInvoiceFile(f);
                      if (f) setInvoiceId("");
                    }}
                  />
                  {invoiceFile ? (
                    <>
                      <span className="text-xs truncate min-w-0">{invoiceFile.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setInvoiceFile(null);
                          if (invoiceInputRef.current) invoiceInputRef.current.value = "";
                        }}
                        className="text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
                        aria-label="Retirer la facture"
                      >
                        <X className="size-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => invoiceInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <Paperclip className="size-3.5" />
                      ou joindre un PDF
                    </button>
                  )}
                </div>
              </div>

              {/* Date d'entrée */}
              <FormField
                control={form.control}
                name="entry_date"
                render={({ field }) => (
                  <FormItem className="border-t px-5 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        Date d&apos;entrée
                      </span>
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
                  disabled={createEntry.isPending || isLinkingInvoice}
                  className="w-full h-10 rounded-lg"
                >
                  {(createEntry.isPending || isLinkingInvoice) && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  {isLinkingInvoice ? "Rattachement à la facture…" : "Entrer en stock"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Hors de la modale d'entrée : elle s'ouvre seule, sans superposition */}
      {currentOrganization?.id && (
        <NewInvoiceDialog
          open={newInvoiceOpen}
          onOpenChange={setNewInvoiceOpen}
          organizationId={currentOrganization.id}
          defaultSupplierId={selectedProduct?.supplier_id}
          onCreated={(invoice) => {
            // La nouvelle facture devient celle sélectionnée
            setInvoices((prev) => [invoice, ...prev]);
            setInvoiceId(invoice.id);
          }}
        />
      )}
    </>
  );
}
