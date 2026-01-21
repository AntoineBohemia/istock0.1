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
} from "lucide-react";
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
import {
  Form,
  FormControl,
  FormDescription,
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import {
  createEntry,
  createExit,
  MovementType,
} from "@/lib/supabase/queries/stock-movements";
import { useOrganizationStore } from "@/lib/stores/organization-store";

const FormSchema = z.object({
  direction: z.enum(["entry", "exit"]),
  exit_type: z.enum(["exit_technician", "exit_anonymous", "exit_loss"]).optional(),
  product_id: z.string().min(1, "Veuillez sélectionner un produit"),
  technician_id: z.string().optional(),
  quantity: z.number().min(1, "La quantité doit être au moins 1"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof FormSchema>;

interface CreateMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  stock_current: number;
}

interface Technician {
  id: string;
  first_name: string;
  last_name: string;
}

export default function CreateMovementDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateMovementDialogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const { currentOrganization } = useOrganizationStore();

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      direction: "entry",
      exit_type: "exit_anonymous",
      product_id: "",
      technician_id: "",
      quantity: 1,
      notes: "",
    },
  });

  const direction = form.watch("direction");
  const exitType = form.watch("exit_type");
  const productId = form.watch("product_id");

  useEffect(() => {
    if (open) {
      loadData();
      form.reset();
      setSelectedProduct(null);
    }
  }, [open]);

  useEffect(() => {
    if (productId) {
      const product = products.find((p) => p.id === productId);
      setSelectedProduct(product || null);
    } else {
      setSelectedProduct(null);
    }
  }, [productId, products]);

  const loadData = async () => {
    if (!currentOrganization) {
      setProducts([]);
      setTechnicians([]);
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();

      // Charger les produits
      const { data: productsData } = await supabase
        .from("products")
        .select("id, name, sku, image_url, stock_current")
        .eq("organization_id", currentOrganization.id)
        .order("name");

      setProducts(productsData || []);

      // Charger les techniciens
      const { data: techniciansData } = await supabase
        .from("technicians")
        .select("id, first_name, last_name")
        .eq("organization_id", currentOrganization.id)
        .order("last_name");

      setTechnicians(techniciansData || []);
    } catch (error) {
      toast.error("Erreur lors du chargement des données");
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: FormValues) => {
    if (!currentOrganization) return;
    setIsSubmitting(true);

    try {
      if (data.direction === "entry") {
        await createEntry(currentOrganization.id, data.product_id, data.quantity, data.notes);
        toast.success("Entrée de stock enregistrée");
      } else {
        const exitType = data.exit_type || "exit_anonymous";

        // Vérification du stock
        if (selectedProduct && data.quantity > selectedProduct.stock_current) {
          toast.error(
            `Stock insuffisant. Disponible: ${selectedProduct.stock_current}`
          );
          setIsSubmitting(false);
          return;
        }

        await createExit(
          currentOrganization.id,
          data.product_id,
          data.quantity,
          exitType,
          exitType === "exit_technician" ? data.technician_id : undefined,
          data.notes
        );
        toast.success("Sortie de stock enregistrée");
      }

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de l'enregistrement"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau mouvement de stock</DialogTitle>
          <DialogDescription>
            Enregistrez une entrée ou une sortie de stock
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                        value={field.value}
                        onValueChange={(value) => {
                          if (value) field.onChange(value);
                        }}
                        className="justify-start"
                      >
                        <ToggleGroupItem
                          value="entry"
                          className="data-[state=on]:bg-green-100 data-[state=on]:text-green-700"
                        >
                          <ArrowDownToLine className="mr-2 size-4" />
                          Entrée
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="exit"
                          className="data-[state=on]:bg-red-100 data-[state=on]:text-red-700"
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
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
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
                          <SelectItem value="exit_loss">
                            Perte / Casse
                          </SelectItem>
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
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
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

              {/* Product Select */}
              <FormField
                control={form.control}
                name="product_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Produit *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un produit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {products.map((product) => (
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Selected Product Preview */}
              {selectedProduct && (
                <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
                  <figure className="flex size-12 items-center justify-center rounded-lg border bg-background">
                    {selectedProduct.image_url ? (
                      <Image
                        src={selectedProduct.image_url}
                        width={48}
                        height={48}
                        alt={selectedProduct.name}
                        className="size-full rounded-lg object-cover"
                      />
                    ) : (
                      <ImageIcon className="size-6 text-muted-foreground" />
                    )}
                  </figure>
                  <div className="flex-1">
                    <p className="font-medium">{selectedProduct.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Stock actuel: {selectedProduct.stock_current}
                    </p>
                  </div>
                </div>
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
                          direction === "exit" && selectedProduct
                            ? selectedProduct.stock_current
                            : undefined
                        }
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 1)
                        }
                      />
                    </FormControl>
                    {direction === "exit" && selectedProduct && (
                      <FormDescription>
                        Maximum disponible: {selectedProduct.stock_current}
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
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  Enregistrer
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
