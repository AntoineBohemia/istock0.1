"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircleIcon, ArrowLeft, ImageIcon, Loader2, UploadIcon, XIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import IconPicker from "@/components/icon-picker";
import ProductIconDisplay from "@/components/product-icon-display";
import { useFileUpload } from "@/hooks/use-file-upload";
import AddNewCategory from "./add-category";
import AddNewSupplier from "@/components/add-new-supplier";
import Link from "next/link";
import { Category } from "@/lib/supabase/queries/categories";
import { Supplier } from "@/lib/supabase/queries/suppliers";
import { uploadProductImage } from "@/lib/supabase/queries/products";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { ProductFormSchema, type ProductFormValues } from "@/lib/schemas/product-schema";
import { useCategories, useSuppliers } from "@/hooks/queries";
import { useCreateProduct, useUpdateProduct } from "@/hooks/mutations";

type FormValues = ProductFormValues;

interface AddProductFormProps {
  mode?: "create" | "edit";
  initialData?: Partial<FormValues> & {
    id?: string;
    image_url?: string;
    icon_name?: string | null;
    icon_color?: string | null;
  };
}

export default function AddProductForm({ mode = "create", initialData }: AddProductFormProps) {
  const router = useRouter();
  const { currentOrganization } = useOrganizationStore();
  const { data: categories = [], isLoading: isLoadingCategories } = useCategories(
    currentOrganization?.id
  );
  const { data: suppliers = [], isLoading: isLoadingSuppliers } = useSuppliers(
    currentOrganization?.id
  );
  const createProductMutation = useCreateProduct();
  const updateProductMutation = useUpdateProduct();
  const isSubmitting = createProductMutation.isPending || updateProductMutation.isPending;
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(
    initialData?.image_url || null
  );
  const [iconValue, setIconValue] = useState<{ name: string; color: string } | null>(
    initialData?.icon_name
      ? { name: initialData.icon_name, color: initialData.icon_color ?? "#475569" }
      : null
  );
  const hasInitialIcon = !!initialData?.icon_name;
  const hasInitialImage = !!initialData?.image_url;
  const [activeVisualTab, setActiveVisualTab] = useState<string>(
    hasInitialImage && !hasInitialIcon ? "photo" : "icon"
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(ProductFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      sku: "",
      description: initialData?.description || "",
      price: initialData?.price || "",
      stock_current: initialData?.stock_current || "0",
      stock_min: initialData?.stock_min || "10",
      stock_max: initialData?.stock_max || "100",
      category_id: initialData?.category_id || "",
      supplier_id: initialData?.supplier_id || "",
      is_perishable: initialData?.is_perishable || false,
      track_stock: initialData?.track_stock ?? true,
    },
  });

  const handleCategoryCreated = (_category: Category) => {};
  const handleSupplierCreated = (_supplier: Supplier) => {};

  const [
    { files, isDragging, errors },
    {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      clearFiles,
      getInputProps,
    },
  ] = useFileUpload({
    accept: "image/png,image/jpeg,image/jpg",
    maxSize: 5 * 1024 * 1024,
    multiple: false,
    maxFiles: 1,
  });

  async function onSubmit(data: FormValues) {
    if (!currentOrganization) {
      toast.error("Aucune organisation sélectionnée");
      return;
    }

    try {
      let imageUrl = existingImageUrl;
      if (files.length > 0 && files[0].file instanceof File) {
        setIsUploadingImage(true);
        imageUrl = await uploadProductImage(files[0].file);
        setIsUploadingImage(false);
      }

      const finalCategoryId = data.category_id || null;
      const useIcon = activeVisualTab === "icon" && iconValue;
      const finalIconName = useIcon ? iconValue.name : null;
      const finalIconColor = useIcon ? iconValue.color : null;
      const finalImageUrl = useIcon ? null : imageUrl || null;

      const productData = {
        organization_id: currentOrganization.id,
        name: data.name,
        sku: data.sku || undefined,
        description: data.description || undefined,
        icon_name: finalIconName,
        icon_color: finalIconColor,
        image_url: finalImageUrl || undefined,
        price: data.price ? parseFloat(data.price) : undefined,
        stock_current: data.stock_current ? parseInt(data.stock_current) : 0,
        stock_min: data.stock_min ? parseInt(data.stock_min) : 10,
        stock_max: data.stock_max ? parseInt(data.stock_max) : 100,
        category_id: finalCategoryId,
        supplier_id: data.supplier_id || null,
        is_perishable: data.is_perishable,
        track_stock: data.track_stock,
      };

      if (mode === "edit" && initialData?.id) {
        updateProductMutation.mutate(
          { id: initialData.id, data: productData },
          {
            onSuccess: () => {
              toast.success("Produit mis à jour");
              router.push(`/product/${initialData.id}`);
            },
            onError: (error) => {
              toast.error(error instanceof Error ? error.message : "Erreur lors de la mise à jour");
            },
          }
        );
      } else {
        createProductMutation.mutate(productData, {
          onSuccess: () => {
            toast.success("Produit créé");
            router.push("/product");
          },
          onError: (error) => {
            toast.error(error instanceof Error ? error.message : "Erreur lors de la création");
          },
        });
      }
    } catch (error) {
      setIsUploadingImage(false);
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'upload");
    }
  }

  const handleCancel = () => {
    if (mode === "edit" && initialData?.id) {
      router.push(`/product/${initialData.id}`);
    } else {
      router.push("/product");
    }
  };

  const title = mode === "edit" ? initialData?.name || "Modifier le produit" : "Ajouter un produit";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* ── Header — mirrors detail page ── */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" asChild type="button" className="shrink-0 -ml-2">
                <Link
                  href={
                    mode === "edit" && initialData?.id ? `/product/${initialData.id}` : "/product"
                  }
                >
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
              <div className="min-w-0">
                <h1 className="font-heading text-2xl font-bold tracking-tight truncate">{title}</h1>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline-contrast"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting || isUploadingImage}>
              {(isSubmitting || isUploadingImage) && <Loader2 className="size-4 animate-spin" />}
              {mode === "edit" ? "Enregistrer" : "Créer"}
            </Button>
          </div>
        </div>

        {/* ── Content — same grid as detail page ── */}
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          {/* ── Left column ── */}
          <div className="space-y-5">
            {/* STOCK — same position as detail hero */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-5 pt-4 pb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50">
                  Stock
                </p>
              </div>
              <div className="p-5 pt-2 space-y-4">
                <FormField
                  name="stock_current"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock actuel</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    name="stock_max"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Optimum</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="stock_min"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Seuil critique</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            {/* DÉTAILS — same position as detail page */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-5 pt-4 pb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50">
                  Détails
                </p>
              </div>
              <div className="p-5 pt-2 space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom *</FormLabel>
                      <FormControl>
                        <Input placeholder="Peinture acrylique..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prix HT (€)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          className="max-w-48"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    name="category_id"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Catégorie</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <div className="grow">
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={isLoadingCategories}
                              >
                                <SelectTrigger className="w-full">
                                  {isLoadingCategories ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <SelectValue placeholder="Sélectionnez" />
                                  )}
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    {categories.map((cat) => (
                                      <SelectItem key={cat.id} value={cat.id}>
                                        {cat.name}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </div>
                            <AddNewCategory onCategoryCreated={handleCategoryCreated} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="supplier_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fournisseur</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <div className="grow">
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={isLoadingSuppliers}
                              >
                                <SelectTrigger className="w-full">
                                  {isLoadingSuppliers ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <SelectValue placeholder="Sélectionnez" />
                                  )}
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    {suppliers.map((sup) => (
                                      <SelectItem key={sup.id} value={sup.id}>
                                        {sup.name}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </div>
                            <AddNewSupplier onSupplierCreated={handleSupplierCreated} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Description du produit..." rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          {/* ── Right column — mirrors detail page right ── */}
          <div className="space-y-5">
            {/* VISUEL — same position as image on detail page */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-5 pt-4 pb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50">
                  Visuel
                </p>
              </div>
              <div className="p-5 pt-2">
                <Tabs value={activeVisualTab} onValueChange={setActiveVisualTab}>
                  <TabsList className="w-full">
                    <TabsTrigger value="icon" className="flex-1">
                      Icône
                    </TabsTrigger>
                    <TabsTrigger value="photo" className="flex-1">
                      Photo
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="icon" className="mt-3">
                    <IconPicker value={iconValue} onChange={setIconValue} />
                    {iconValue && (
                      <div className="mt-3 flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">Aperçu :</span>
                        <ProductIconDisplay
                          iconName={iconValue.name}
                          iconColor={iconValue.color}
                          size="lg"
                        />
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="photo" className="mt-3">
                    <div className="flex flex-col gap-2">
                      {existingImageUrl && files.length === 0 && (
                        <div className="relative mb-2 inline-block">
                          <img
                            src={existingImageUrl}
                            alt="Image actuelle"
                            className="h-36 w-36 rounded-lg object-cover"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="destructive"
                            className="absolute -right-2 -top-2 size-6"
                            onClick={() => setExistingImageUrl(null)}
                          >
                            <XIcon className="size-3" />
                          </Button>
                        </div>
                      )}
                      <div
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        data-dragging={isDragging || undefined}
                        data-files={files.length > 0 || undefined}
                        className="border-input data-[dragging=true]:bg-accent/50 has-[input:focus]:border-ring has-[input:focus]:ring-ring/50 relative flex min-h-32 flex-col items-center overflow-hidden rounded-xl border border-dashed p-4 transition-colors not-data-[files]:justify-center has-[input:focus]:ring-[3px]"
                      >
                        <input {...getInputProps()} className="sr-only" aria-label="Upload image" />
                        {files.length > 0 ? (
                          <div className="flex w-full flex-col gap-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium">Nouvelle image</span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => clearFiles()}
                              >
                                Supprimer
                              </Button>
                            </div>
                            <div className="flex justify-center">
                              {files.map((file) => (
                                <div
                                  key={file.id}
                                  className="bg-accent relative aspect-square w-32 rounded-md border"
                                >
                                  <img
                                    src={file.preview}
                                    alt={file.file.name}
                                    className="size-full rounded-[inherit] object-cover"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center px-4 py-2 text-center">
                            <div className="bg-background mb-2 flex size-10 items-center justify-center rounded-full border">
                              <ImageIcon className="size-4 opacity-60" />
                            </div>
                            <p className="text-sm font-medium">Déposez une image</p>
                            <p className="text-muted-foreground text-xs">PNG ou JPG (max. 5MB)</p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-3"
                              onClick={openFileDialog}
                            >
                              <UploadIcon className="-ms-1 opacity-60" />
                              Sélectionner
                            </Button>
                          </div>
                        )}
                      </div>
                      {errors.length > 0 && (
                        <div
                          className="text-destructive flex items-center gap-1 text-xs"
                          role="alert"
                        >
                          <AlertCircleIcon className="size-3 shrink-0" />
                          <span>{errors[0]}</span>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            {/* OPTIONS — same position as QR code on detail page */}
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-5 pt-4 pb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/50">
                  Options
                </p>
              </div>
              <div className="p-5 pt-2 space-y-4">
                <FormField
                  control={form.control}
                  name="is_perishable"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="font-normal">Produit périssable</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="track_stock"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between">
                      <FormLabel className="font-normal">Suivi du stock</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}
