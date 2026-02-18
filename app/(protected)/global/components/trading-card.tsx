"use client";

import { useState } from "react";
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
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useProducts, useTechnicians } from "@/hooks/queries";
import { useCreateStockEntry, useCreateStockExit } from "@/hooks/mutations";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  stock_current: number;
  price: number | null;
  organization_id: string;
}

const EntrySchema = z.object({
  product_id: z.string().min(1, "Sélectionnez un produit"),
  quantity: z.number().min(1, "La quantité doit être au moins 1"),
});

const EXIT_TYPES = [
  { value: "exit_technician", label: "Sortie technicien" },
  { value: "exit_anonymous", label: "Sortie anonyme" },
  { value: "exit_loss", label: "Perte/Casse" },
] as const;

const ExitSchema = z.object({
  product_id: z.string().min(1, "Sélectionnez un produit"),
  quantity: z.number().min(1, "La quantité doit être au moins 1"),
  exit_type: z.enum(["exit_technician", "exit_anonymous", "exit_loss"]),
  technician_id: z.string().optional(),
}).refine(
  (data) => data.exit_type !== "exit_technician" || (data.technician_id && data.technician_id.length > 0),
  {
    message: "Sélectionnez un technicien pour ce type de sortie",
    path: ["technician_id"],
  }
);

type EntryFormValues = z.infer<typeof EntrySchema>;
type ExitFormValues = z.infer<typeof ExitSchema>;

export function StockMovementCard() {
  const { currentOrganization } = useOrganizationStore();
  const { data: productsResult, isLoading: isLoadingProducts } = useProducts({
    organizationId: currentOrganization?.id,
    pageSize: 1000,
  });
  const { data: techniciansData = [], isLoading: isLoadingTechnicians } = useTechnicians(currentOrganization?.id);
  const createEntryMutation = useCreateStockEntry();
  const createExitMutation = useCreateStockExit();

  const products: Product[] = (productsResult?.products || []).map(p => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    image_url: p.image_url,
    stock_current: p.stock_current,
    price: p.price,
    organization_id: p.organization_id,
  }));
  const technicians = techniciansData;

  const isLoading = isLoadingProducts || isLoadingTechnicians;
  const isSubmitting = createEntryMutation.isPending || createExitMutation.isPending;

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
      exit_type: "exit_technician",
      technician_id: "",
    },
  });

  const selectedExitType = exitForm.watch("exit_type");

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

  const onEntrySubmit = (data: EntryFormValues) => {
    if (!currentOrganization) return;
    createEntryMutation.mutate(
      {
        organizationId: currentOrganization.id,
        productId: data.product_id,
        quantity: data.quantity,
      },
      {
        onSuccess: () => {
          toast.success(`Entrée de ${data.quantity} unités enregistrée`);
          entryForm.reset();
          setSelectedEntryProduct(null);
        },
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : "Erreur lors de l'enregistrement"
          );
        },
      }
    );
  };

  const onExitSubmit = (data: ExitFormValues) => {
    if (!currentOrganization) return;

    if (selectedExitProduct && data.quantity > selectedExitProduct.stock_current) {
      toast.error(
        `Stock insuffisant. Disponible: ${selectedExitProduct.stock_current}`
      );
      return;
    }

    createExitMutation.mutate(
      {
        organizationId: currentOrganization.id,
        productId: data.product_id,
        quantity: data.quantity,
        type: data.exit_type,
        technicianId: data.exit_type === "exit_technician" ? data.technician_id : undefined,
      },
      {
        onSuccess: () => {
          const exitTypeLabel = EXIT_TYPES.find((t) => t.value === data.exit_type)?.label || "Sortie";
          toast.success(`${exitTypeLabel} de ${data.quantity} unités enregistrée`);
          exitForm.reset();
          setSelectedExitProduct(null);
        },
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : "Erreur lors de l'enregistrement"
          );
        },
      }
    );
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
                  name="exit_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type de sortie</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Sélectionner un type" />
                          </SelectTrigger>
                          <SelectContent>
                            {EXIT_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedExitType === "exit_technician" && (
                  <FormField
                    control={exitForm.control}
                    name="technician_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Technicien</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Sélectionner un technicien" />
                            </SelectTrigger>
                            <SelectContent>
                              {technicians.map((tech) => (
                                <SelectItem key={tech.id} value={tech.id}>
                                  {tech.first_name} {tech.last_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
