"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ImageIcon, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { createEntry, createExit } from "@/lib/supabase/queries/stock-movements";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  stock_current: number;
  price: number | null;
}

const EntrySchema = z.object({
  product_id: z.string().min(1, "Sélectionnez un produit"),
  quantity: z.number().min(1, "La quantité doit être au moins 1"),
});

const ExitSchema = z.object({
  product_id: z.string().min(1, "Sélectionnez un produit"),
  quantity: z.number().min(1, "La quantité doit être au moins 1"),
});

type EntryFormValues = z.infer<typeof EntrySchema>;
type ExitFormValues = z.infer<typeof ExitSchema>;

export function StockMovementCard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedEntryProduct, setSelectedEntryProduct] = useState<Product | null>(null);
  const [selectedExitProduct, setSelectedExitProduct] = useState<Product | null>(null);

  const entryForm = useForm<EntryFormValues>({
    resolver: zodResolver(EntrySchema),
    defaultValues: {
      product_id: "",
      quantity: 1,
    },
  });

  const exitForm = useForm<ExitFormValues>({
    resolver: zodResolver(ExitSchema),
    defaultValues: {
      product_id: "",
      quantity: 1,
    },
  });

  useEffect(() => {
    async function loadProducts() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("products")
          .select("id, name, sku, image_url, stock_current, price")
          .order("name");

        if (error) throw error;
        setProducts(data || []);
      } catch (error) {
        console.error("Error loading products:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadProducts();
  }, []);

  const handleEntryProductChange = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    setSelectedEntryProduct(product || null);
    entryForm.setValue("product_id", productId);
  };

  const handleExitProductChange = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    setSelectedExitProduct(product || null);
    exitForm.setValue("product_id", productId);
  };

  const onEntrySubmit = async (data: EntryFormValues) => {
    setIsSubmitting(true);
    try {
      await createEntry(data.product_id, data.quantity);
      toast.success(`Entrée de ${data.quantity} unités enregistrée`);
      entryForm.reset();
      setSelectedEntryProduct(null);

      // Refresh products list
      const supabase = createClient();
      const { data: updatedProducts } = await supabase
        .from("products")
        .select("id, name, sku, image_url, stock_current, price")
        .order("name");
      if (updatedProducts) setProducts(updatedProducts);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de l'enregistrement"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const onExitSubmit = async (data: ExitFormValues) => {
    setIsSubmitting(true);
    try {
      // Vérifier le stock disponible
      if (selectedExitProduct && data.quantity > selectedExitProduct.stock_current) {
        toast.error(
          `Stock insuffisant. Disponible: ${selectedExitProduct.stock_current}`
        );
        setIsSubmitting(false);
        return;
      }

      await createExit(data.product_id, data.quantity, "exit_anonymous");
      toast.success(`Sortie de ${data.quantity} unités enregistrée`);
      exitForm.reset();
      setSelectedExitProduct(null);

      // Refresh products list
      const supabase = createClient();
      const { data: updatedProducts } = await supabase
        .from("products")
        .select("id, name, sku, image_url, stock_current, price")
        .order("name");
      if (updatedProducts) setProducts(updatedProducts);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de l'enregistrement"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardDescription>Créer un mouvement de stock</CardDescription>
        <CardTitle className="font-display text-3xl">Gestion du stock</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="entry">
          <TabsList className="mb-4 w-full">
            <TabsTrigger className="w-full" value="entry">
              Entrée
            </TabsTrigger>
            <TabsTrigger className="w-full" value="exit">
              Sortie
            </TabsTrigger>
          </TabsList>

          {/* Entrée de stock */}
          <TabsContent value="entry">
            <Form {...entryForm}>
              <form
                onSubmit={entryForm.handleSubmit(onEntrySubmit)}
                className="space-y-4"
              >
                <FormField
                  control={entryForm.control}
                  name="product_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Produit</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={handleEntryProductChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Sélectionner un produit" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                <div className="flex items-center gap-2">
                                  <span>{product.name}</span>
                                  {product.sku && (
                                    <span className="text-muted-foreground">
                                      ({product.sku})
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedEntryProduct && (
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
                    <figure className="flex size-10 items-center justify-center rounded-lg border bg-background">
                      {selectedEntryProduct.image_url ? (
                        <Image
                          src={selectedEntryProduct.image_url}
                          width={40}
                          height={40}
                          alt={selectedEntryProduct.name}
                          className="size-full rounded-lg object-cover"
                        />
                      ) : (
                        <ImageIcon className="size-5 text-muted-foreground" />
                      )}
                    </figure>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        Stock: {selectedEntryProduct.stock_current}
                      </p>
                      {selectedEntryProduct.price && (
                        <p className="text-xs text-muted-foreground">
                          {selectedEntryProduct.price.toLocaleString("fr-FR", {
                            style: "currency",
                            currency: "EUR",
                          })}{" "}
                          / unité
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <FormField
                  control={entryForm.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantité</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 1)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" />
                      Effectuer l'entrée
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </TabsContent>

          {/* Sortie de stock */}
          <TabsContent value="exit">
            <Form {...exitForm}>
              <form
                onSubmit={exitForm.handleSubmit(onExitSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={exitForm.control}
                  name="product_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Produit</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={handleExitProductChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Sélectionner un produit" />
                          </SelectTrigger>
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
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedExitProduct && (
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
                    <figure className="flex size-10 items-center justify-center rounded-lg border bg-background">
                      {selectedExitProduct.image_url ? (
                        <Image
                          src={selectedExitProduct.image_url}
                          width={40}
                          height={40}
                          alt={selectedExitProduct.name}
                          className="size-full rounded-lg object-cover"
                        />
                      ) : (
                        <ImageIcon className="size-5 text-muted-foreground" />
                      )}
                    </figure>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        Disponible: {selectedExitProduct.stock_current}
                      </p>
                      {selectedExitProduct.price && (
                        <p className="text-xs text-muted-foreground">
                          {selectedExitProduct.price.toLocaleString("fr-FR", {
                            style: "currency",
                            currency: "EUR",
                          })}{" "}
                          / unité
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <FormField
                  control={exitForm.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantité</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={selectedExitProduct?.stock_current || undefined}
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 1)
                          }
                        />
                      </FormControl>
                      {selectedExitProduct && (
                        <p className="text-xs text-muted-foreground">
                          Maximum: {selectedExitProduct.stock_current}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full bg-red-600 hover:bg-red-700"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="size-4" />
                      Effectuer la sortie
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
