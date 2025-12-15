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
  const [product, setProduct] = useState<Product | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      direction: "exit",
      exit_type: "exit_anonymous",
      technician_id: "",
      quantity: 1,
      notes: "",
    },
  });

  const direction = form.watch("direction");
  const exitType = form.watch("exit_type");

  // Fetch product when productId changes
  useEffect(() => {
    if (!productId || !open) {
      setProduct(null);
      return;
    }

    async function fetchProduct() {
      setIsLoading(true);
      try {
        const supabase = createClient();

        const [productRes, techniciansRes] = await Promise.all([
          supabase
            .from("products")
            .select("id, name, sku, image_url, stock_current, price")
            .eq("id", productId)
            .single(),
          supabase
            .from("technicians")
            .select("id, first_name, last_name")
            .order("last_name"),
        ]);

        if (productRes.error) {
          toast.error("Produit non trouvé");
          onClose();
          return;
        }

        setProduct(productRes.data);
        setTechnicians(techniciansRes.data || []);
      } catch (error) {
        toast.error("Erreur lors du chargement du produit");
        onClose();
      } finally {
        setIsLoading(false);
      }
    }

    fetchProduct();
    form.reset({
      direction: "exit",
      exit_type: "exit_anonymous",
      technician_id: "",
      quantity: 1,
      notes: "",
    });
  }, [productId, open]);

  const onSubmit = async (data: FormValues) => {
    if (!product) return;

    setIsSubmitting(true);

    try {
      if (data.direction === "entry") {
        await createEntry(product.id, data.quantity, data.notes);
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

        {isLoading ? (
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
                        value={field.value}
                        onValueChange={(value) => {
                          if (value) field.onChange(value);
                        }}
                        className="justify-start"
                      >
                        <ToggleGroupItem
                          value="entry"
                          className="data-[state=on]:bg-green-100 data-[state=on]:text-green-700 dark:data-[state=on]:bg-green-900 dark:data-[state=on]:text-green-100"
                        >
                          <ArrowDownToLine className="mr-2 size-4" />
                          Entrée
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="exit"
                          className="data-[state=on]:bg-red-100 data-[state=on]:text-red-700 dark:data-[state=on]:bg-red-900 dark:data-[state=on]:text-red-100"
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
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-600 hover:bg-red-700"
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
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            Aucun produit sélectionné
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
