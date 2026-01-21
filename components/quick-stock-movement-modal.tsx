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
import { toast } from "sonner";

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
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
import { createClient } from "@/lib/supabase/client";
import { createEntry, createExit } from "@/lib/supabase/queries/stock-movements";
import { useOrganizationStore } from "@/lib/stores/organization-store";

interface QuickStockMovementModalProps {
  open: boolean;
  onClose: () => void;
  productId: string | null;
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  stock_current: number;
  price: number | null;
}

interface Technician {
  id: string;
  first_name: string;
  last_name: string;
}

const FormSchema = z.object({
  direction: z.enum(["entry", "exit"]),
  exit_type: z.enum(["exit_technician", "exit_anonymous", "exit_loss"]).optional(),
  technician_id: z.string().optional(),
  quantity: z.number().min(1, "La quantité doit être au moins 1"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof FormSchema>;

export default function QuickStockMovementModal({
  open,
  onClose,
  productId,
}: QuickStockMovementModalProps) {
  const { currentOrganization, isLoading: isOrgLoading } = useOrganizationStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      direction: "entry",
      exit_type: "exit_anonymous",
      technician_id: "",
      quantity: 1,
      notes: "",
    },
  });

  const direction = form.watch("direction");
  const exitType = form.watch("exit_type");

  // Fetch data when modal opens
  useEffect(() => {
    if (!open) {
      setProduct(null);
      setAllProducts([]);
      return;
    }

    // Wait for organization to load
    if (isOrgLoading || !currentOrganization) {
      return;
    }

    const organizationId = currentOrganization.id;

    async function fetchData() {
      setIsLoading(true);
      try {
        const supabase = createClient();

        // Always fetch technicians and all products (for manual selection)
        const [techniciansRes, productsRes] = await Promise.all([
          supabase
            .from("technicians")
            .select("id, first_name, last_name")
            .eq("organization_id", organizationId)
            .order("last_name"),
          supabase
            .from("products")
            .select("id, name, sku, image_url, stock_current, price")
            .eq("organization_id", organizationId)
            .order("name"),
        ]);

        setTechnicians(techniciansRes.data || []);
        setAllProducts(productsRes.data || []);

        // If productId is provided, find and set the product
        if (productId) {
          const foundProduct = productsRes.data?.find(p => p.id === productId);
          if (foundProduct) {
            setProduct(foundProduct);
          } else {
            toast.error("Produit non trouvé");
            onClose();
            return;
          }
        }
      } catch (error) {
        toast.error("Erreur lors du chargement des données");
        onClose();
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
    form.reset({
      direction: "entry",
      exit_type: "exit_anonymous",
      technician_id: "",
      quantity: 1,
      notes: "",
    });
  }, [productId, open, currentOrganization, isOrgLoading]);

  const selectProduct = (selectedProduct: Product) => {
    setProduct(selectedProduct);
    setProductPopoverOpen(false);
  };

  const onSubmit = async (data: FormValues) => {
    if (!product || !currentOrganization) return;

    setIsSubmitting(true);

    try {
      if (data.direction === "entry") {
        await createEntry(currentOrganization.id, product.id, data.quantity, data.notes);
        toast.success(
          `+${data.quantity} ${product.name} ajouté(s) au stock`
        );
      } else {
        const exitType = data.exit_type || "exit_anonymous";

        // Validate stock
        if (data.quantity > product.stock_current) {
          toast.error(
            `Stock insuffisant. Disponible: ${product.stock_current}`
          );
          setIsSubmitting(false);
          return;
        }

        // Validate technician for exit_technician type
        if (exitType === "exit_technician" && !data.technician_id) {
          toast.error("Veuillez sélectionner un technicien");
          setIsSubmitting(false);
          return;
        }

        await createExit(
          currentOrganization.id,
          product.id,
          data.quantity,
          exitType,
          exitType === "exit_technician" ? data.technician_id : undefined,
          data.notes
        );

        toast.success(
          `-${data.quantity} ${product.name} retiré(s) du stock`
        );
      }

      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de l'enregistrement"
      );
    } finally {
      setIsSubmitting(false);
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
          <DialogDescription>
            Enregistrez une entrée ou sortie rapide
          </DialogDescription>
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
                    <p className="text-xs text-muted-foreground font-mono">
                      {product.sku}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">
                      Stock: {product.stock_current}
                    </Badge>
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
                        type="single"
                        variant="outline"
                        value={field.value}
                        onValueChange={(value) => {
                          if (value) field.onChange(value);
                        }}
                        className="w-full"
                      >
                        <ToggleGroupItem
                          value="entry"
                          className="flex-1 data-[state=on]:bg-emerald-100 data-[state=on]:text-emerald-700 data-[state=on]:border-emerald-300 dark:data-[state=on]:bg-emerald-900 dark:data-[state=on]:text-emerald-100"
                        >
                          <ArrowDownToLine className="mr-2 size-4" />
                          Entrée
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="exit"
                          className="flex-1 data-[state=on]:bg-rose-100 data-[state=on]:text-rose-700 data-[state=on]:border-rose-300 dark:data-[state=on]:bg-rose-900 dark:data-[state=on]:text-rose-100"
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
                          <SelectItem value="exit_technician">
                            Vers technicien
                          </SelectItem>
                          <SelectItem value="exit_anonymous">
                            Sortie anonyme
                          </SelectItem>
                          <SelectItem value="exit_loss">Perte / Casse</SelectItem>
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
                        max={
                          direction === "exit" ? product.stock_current : undefined
                        }
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 1)
                        }
                      />
                    </FormControl>
                    {direction === "exit" && (
                      <FormDescription>
                        Maximum disponible: {product.stock_current}
                      </FormDescription>
                    )}
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
                      <Textarea
                        placeholder="Notes optionnelles..."
                        rows={2}
                        {...field}
                      />
                    </FormControl>
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
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className={
                    direction === "entry"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }
                >
                  {isSubmitting && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  {direction === "entry" ? "Ajouter au stock" : "Retirer du stock"}
                </Button>
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
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                  >
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
