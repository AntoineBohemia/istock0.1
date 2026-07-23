"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Loader2,
  ImageIcon,
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  Search,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { toast } from "@/lib/toast";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useProducts, useTechnicians, useSuppliers } from "@/hooks/queries";
import { useCreateStockEntry, useCreateStockExit } from "@/hooks/mutations";
import { maxSingleOrgStock, pickExitSource, type OrgStock } from "@/lib/utils/exit-source";

interface QuickStockMovementModalProps {
  open: boolean;
  onClose: () => void;
  productId: string | null;
  defaultDirection?: "entry" | "exit";
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  stock_current: number | null;
  price: number | null;
  supplier_id: string | null;
  /**
   * Ce que detient chaque societe.
   *
   * Une sortie puise chez celle qui en a le moins ; le choix depend de la
   * quantite demandee, qui change encore apres la selection du produit. On
   * transporte donc la ventilation, pas une societe deja designee.
   */
  org_stock: OrgStock[];
}

interface Technician {
  id: string;
  first_name: string;
  last_name: string;
}

const today = new Date();
const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);

const FormSchema = z.object({
  direction: z.enum(["entry", "exit"]),
  exit_type: z.enum(["exit_technician", "exit_anonymous"]).optional(),
  technician_id: z.string().optional(),
  supplier_id: z.string().optional(),
  invoice_reference: z.string().optional(),
  entry_date: z.string().optional(),
  quantity: z.number().min(1, "La quantité doit être au moins 1"),
  // Motif d'une erreur de stock : ce qu'on relit sur le detail du mouvement.
  note: z.string().optional(),
});

type FormValues = z.infer<typeof FormSchema>;

export default function QuickStockMovementModal({
  open,
  onClose,
  productId,
  defaultDirection = "entry",
}: QuickStockMovementModalProps) {
  const shouldReduceMotion = useReducedMotion();
  const { currentOrganization, organizations, isLoading: isOrgLoading } = useOrganizationStore();
  const { data: productsResult, isLoading: isLoadingProducts } = useProducts({
    organizationId: currentOrganization?.id,
  });
  const { data: techniciansData = [], isLoading: isLoadingTechnicians } = useTechnicians(
    currentOrganization?.id
  );
  const { data: suppliers = [] } = useSuppliers(currentOrganization?.id);
  const createEntryMutation = useCreateStockEntry();
  const createExitMutation = useCreateStockExit();

  const allProducts: Product[] = (productsResult?.products || []).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    image_url: p.image_url,
    stock_current: p.stock_current,
    price: p.price,
    supplier_id: p.supplier_id,
    // Limite aux societes de l'application : la base garde des organisations
    // de test qui ne doivent jamais pouvoir etre designees comme source.
    org_stock: organizations.flatMap((org) => {
      const row = p.product_organization_stock?.find((x) => x.organization_id === org.id);
      return row ? [{ id: org.id, name: org.name, stock: row.stock_current }] : [];
    }),
  }));
  const technicians: Technician[] = techniciansData.map((t) => ({
    id: t.id,
    first_name: t.first_name,
    last_name: t.last_name,
  }));

  const [product, setProduct] = useState<Product | null>(null);
  const isLoading = isLoadingProducts || isLoadingTechnicians;
  const isSubmitting = createEntryMutation.isPending || createExitMutation.isPending;
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      direction: "entry",
      exit_type: "exit_anonymous",
      technician_id: "",
      quantity: 1,
    },
  });

  const direction = form.watch("direction");
  const exitType = form.watch("exit_type");
  const quantity = form.watch("quantity");

  // ─── Societe debitee par une sortie ─────────────────────
  // Regle metier : on puise chez celle qui en a le moins. Une entree, elle,
  // reste rattachee a la societe courante — c'est un choix, pas une deduction.
  //
  // L'outillage n'a pas de ventilation par societe : sans ligne a comparer, on
  // retombe sur la societe courante.
  const exitSource =
    direction === "exit" && product
      ? (pickExitSource(product.org_stock, quantity || 1) ??
        (currentOrganization
          ? {
              id: currentOrganization.id,
              name: currentOrganization.name,
              stock: product.stock_current ?? 0,
            }
          : null))
      : null;

  // Ce que la sortie peut prendre : le stock d'une seule societe, jamais le
  // cumul — une sortie ne se decoupe pas entre les deux.
  const exitCeiling =
    product && product.org_stock.length > 0
      ? maxSingleOrgStock(product.org_stock)
      : (product?.stock_current ?? 0);

  // Handle modal open/close and product selection
  useEffect(() => {
    if (!open) {
      setProduct(null);
      return;
    }

    // If productId is provided, find and set the product from cached data
    let matchedProduct: Product | undefined;
    if (productId && allProducts.length > 0) {
      matchedProduct = allProducts.find((p) => p.id === productId);
      if (matchedProduct) {
        setProduct(matchedProduct);
      } else {
        toast.error("Produit non trouvé");
        onClose();
        return;
      }
    }

    form.reset({
      direction: defaultDirection,
      exit_type: "exit_anonymous",
      technician_id: "",
      supplier_id: matchedProduct?.supplier_id || "",
      invoice_reference: "",
      entry_date: "",
      quantity: 1,
      note: "",
    });
  }, [productId, open, allProducts.length, defaultDirection]);

  const selectProduct = (selectedProduct: Product) => {
    setProduct(selectedProduct);
    setProductPopoverOpen(false);
  };

  const onSubmit = (data: FormValues) => {
    if (!product || !currentOrganization) return;

    if (data.direction === "entry") {
      createEntryMutation.mutate(
        {
          organizationId: currentOrganization.id,
          productId: product.id,
          quantity: data.quantity,
          supplierId: data.supplier_id || undefined,
          invoiceReference: data.invoice_reference || undefined,
          entryDate: data.entry_date ? new Date(data.entry_date).toISOString() : undefined,
        },
        {
          onSuccess: () => {
            toast.success(`+${data.quantity} ${product.name} ajouté(s) au stock`);
            onClose();
          },
          onError: (error) => {
            toast.error(error instanceof Error ? error.message : "Erreur lors de l'enregistrement");
          },
        }
      );
    } else {
      const exitTypeValue = data.exit_type || "exit_anonymous";

      if (!exitSource) {
        toast.error(`Aucun stock disponible pour ${product.name}`);
        return;
      }

      if (data.quantity > exitSource.stock) {
        toast.error(`${exitSource.name} n'en a que ${exitSource.stock}`);
        return;
      }

      if (exitTypeValue === "exit_technician" && !data.technician_id) {
        toast.error("Veuillez sélectionner un technicien");
        return;
      }

      createExitMutation.mutate(
        {
          organizationId: exitSource.id,
          productId: product.id,
          quantity: data.quantity,
          type: exitTypeValue,
          technicianId: exitTypeValue === "exit_technician" ? data.technician_id : undefined,
          note: exitTypeValue === "exit_anonymous" ? data.note?.trim() || undefined : undefined,
        },
        {
          onSuccess: () => {
            // La societe est nommee : elle n'a pas ete choisie, la regle l'a
            // designee.
            toast.success(`-${data.quantity} ${product.name} — ${exitSource.name}`);
            onClose();
          },
          onError: (error) => {
            toast.error(error instanceof Error ? error.message : "Erreur lors de l'enregistrement");
          },
        }
      );
    }
  };

  const handleClose = () => {
    form.reset();
    setProduct(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-5" />
            Mouvement de stock
          </DialogTitle>
          <DialogDescription>Enregistrez une entrée ou sortie rapide</DialogDescription>
        </DialogHeader>

        {isLoading || isOrgLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : product ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Product Info */}
              <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
                <figure className="flex size-14 items-center justify-center rounded-lg border bg-background">
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      width={56}
                      height={56}
                      alt={product.name}
                      className="size-full rounded-lg object-cover"
                    />
                  ) : (
                    <ImageIcon className="size-6 text-muted-foreground" />
                  )}
                </figure>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{product.name}</p>
                  {product.sku && (
                    <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">Stock: {product.stock_current}</Badge>
                    {product.price && (
                      <span className="text-xs text-muted-foreground">
                        {product.price.toLocaleString("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                        })}
                      </span>
                    )}
                  </div>
                </div>
                {/* Allow changing product if no productId was provided */}
                {!productId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setProduct(null)}
                    className="text-xs"
                  >
                    Changer
                  </Button>
                )}
              </div>

              {/* Direction Toggle */}
              <FormField
                control={form.control}
                name="direction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de mouvement</FormLabel>
                    <FormControl>
                      <ToggleGroup
                        variant="outline"
                        value={field.value ? [field.value] : []}
                        onValueChange={(value) => {
                          if (value[0]) field.onChange(value[0]);
                        }}
                        className="w-full"
                      >
                        <ToggleGroupItem
                          value="entry"
                          className="flex-1 data-pressed:bg-primary data-pressed:text-primary-foreground data-pressed:border-primary"
                        >
                          <ArrowDownToLine className="mr-2 size-4" />
                          Entrée
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="exit"
                          className="flex-1 data-pressed:bg-muted data-pressed:text-foreground"
                        >
                          <ArrowUpFromLine className="mr-2 size-4" />
                          Sortie
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Supplier (only for entries) */}
              {direction === "entry" && suppliers.length > 0 && (
                <FormField
                  control={form.control}
                  name="supplier_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Société / Fournisseur</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner une société" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {suppliers.map((sup) => (
                            <SelectItem key={sup.id} value={sup.id}>
                              {sup.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Invoice Reference (only for entries) */}
              {direction === "entry" && (
                <FormField
                  control={form.control}
                  name="invoice_reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Réf. facture</FormLabel>
                      <FormControl>
                        <Input type="text" placeholder="FA-2026-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Entry Date (only for entries) */}
              {direction === "entry" && (
                <FormField
                  control={form.control}
                  name="entry_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date d'entrée</FormLabel>
                      <DatePicker
                        value={field.value ? new Date(field.value) : undefined}
                        onChange={(date) => field.onChange(date?.toISOString().split("T")[0] ?? "")}
                        disabled={{ after: today, before: ninetyDaysAgo }}
                        placeholder="Aujourd'hui"
                        className="w-full"
                      />
                      {field.value && field.value !== today.toISOString().split("T")[0] && (
                        <FormDescription className="text-amber-600 dark:text-amber-400">
                          Date antérieure à aujourd'hui
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Exit Type (only for exits) */}
              {direction === "exit" && (
                <FormField
                  control={form.control}
                  name="exit_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type de sortie</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner le type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="exit_technician">Sortie technicien</SelectItem>
                          <SelectItem value="exit_anonymous">Perte ou erreur</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Technician Select (only for exit_technician) */}
              {direction === "exit" && exitType === "exit_technician" && (
                <FormField
                  control={form.control}
                  name="technician_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Technicien *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un technicien" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {technicians.map((tech) => (
                            <SelectItem key={tech.id} value={tech.id}>
                              {tech.first_name} {tech.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Motif — seulement pour une erreur de stock. C'est ce qui
                  s'affiche sur le detail du mouvement ; une sortie technicien
                  s'explique deja par son destinataire. */}
              {direction === "exit" && exitType === "exit_anonymous" && (
                <FormField
                  control={form.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motif</FormLabel>
                      <FormControl>
                        <Textarea rows={2} placeholder="Cassé, perdu, volé…" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Quantity */}
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantité *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={direction === "exit" ? exitCeiling : undefined}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    {/* La societe debitee est nommee : l'utilisateur ne l'a pas
                        choisie, c'est la regle du « moins fourni ». Sans elle,
                        le maximum affiche n'aurait pas d'explication. */}
                    {direction === "exit" && exitSource && (
                      <FormDescription>
                        Sortie de {exitSource.name} — {exitSource.stock} disponible
                        {exitSource.stock > 1 ? "s" : ""}
                        {product.org_stock.length > 1 && (
                          <span className="text-muted-foreground">
                            {" · "}
                            {product.org_stock.map((o) => `${o.name} ${o.stock}`).join(" · ")}
                          </span>
                        )}
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Annuler
                </Button>
                <motion.div
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                  transition={{ type: "spring", bounce: 0.1, duration: 0.2 }}
                >
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    variant={direction === "entry" ? "default" : "outline"}
                    onClick={() => navigator.vibrate?.(15)}
                  >
                    {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                    {direction === "entry" ? "Entrée" : "Sortie"}
                  </Button>
                </motion.div>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          /* Product Selection - when no product is selected */
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Sélectionner un produit</p>
              <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <Search className="mr-2 size-4" />
                    Rechercher un produit...
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Rechercher par nom ou SKU..." />
                    <CommandList>
                      <CommandEmpty>Aucun produit trouvé</CommandEmpty>
                      <CommandGroup>
                        {allProducts.map((p) => (
                          <CommandItem
                            key={p.id}
                            onSelect={() => selectProduct(p)}
                            className="flex items-center gap-3"
                          >
                            <figure className="flex size-10 items-center justify-center rounded border bg-muted shrink-0">
                              {p.image_url ? (
                                <Image
                                  src={p.image_url}
                                  width={40}
                                  height={40}
                                  alt={p.name}
                                  className="size-full rounded object-cover"
                                />
                              ) : (
                                <ImageIcon className="size-4 text-muted-foreground" />
                              )}
                            </figure>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate text-sm">{p.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {p.sku && <span className="font-mono">{p.sku} • </span>}
                                Stock: {p.stock_current}
                              </p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              ou scannez un QR code produit
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
