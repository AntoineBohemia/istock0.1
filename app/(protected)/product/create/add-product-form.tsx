"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircleIcon,
  ChevronLeft,
  ImageIcon,
  Loader2,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { useFileUpload } from "@/hooks/use-file-upload";
import AddNewCategory from "./add-category";
import Link from "next/link";
import {
  getParentCategories,
  getSubCategories,
  Category,
} from "@/lib/supabase/queries/categories";
import {
  createProduct,
  updateProduct,
  uploadProductImage,
} from "@/lib/supabase/queries/products";

const FormSchema = z.object({
  name: z.string().min(2, {
    message: "Le nom du produit doit contenir au moins 2 caractères.",
  }),
  sku: z.string().optional(),
  description: z.string().optional(),
  price: z.string().optional(),
  stock_current: z.string().optional(),
  stock_min: z.string().optional(),
  stock_max: z.string().optional(),
  category_id: z.string().optional(),
  sub_category_id: z.string().optional(),
  supplier_name: z.string().optional(),
  is_perishable: z.boolean(),
  track_stock: z.boolean(),
});

type FormValues = z.infer<typeof FormSchema>;

interface AddProductFormProps {
  mode?: "create" | "edit";
  initialData?: Partial<FormValues> & { id?: string; image_url?: string };
}

export default function AddProductForm({
  mode = "create",
  initialData,
}: AddProductFormProps) {
  const router = useRouter();
  const [parentCategories, setParentCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    initialData?.category_id || ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(
    initialData?.image_url || null
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: initialData?.name || "",
      sku: initialData?.sku || "",
      description: initialData?.description || "",
      price: initialData?.price || "",
      stock_current: initialData?.stock_current || "0",
      stock_min: initialData?.stock_min || "10",
      stock_max: initialData?.stock_max || "100",
      category_id: initialData?.category_id || "",
      sub_category_id: initialData?.sub_category_id || "",
      supplier_name: initialData?.supplier_name || "",
      is_perishable: initialData?.is_perishable || false,
      track_stock: initialData?.track_stock ?? true,
    },
  });

  // Charger les catégories parentes au montage
  useEffect(() => {
    async function loadCategories() {
      try {
        const categories = await getParentCategories();
        setParentCategories(categories);
      } catch (error) {
        toast.error("Erreur lors du chargement des catégories");
      } finally {
        setIsLoadingCategories(false);
      }
    }
    loadCategories();
  }, []);

  // Charger les sous-catégories quand une catégorie parente est sélectionnée
  useEffect(() => {
    async function loadSubCategories() {
      if (!selectedCategoryId) {
        setSubCategories([]);
        return;
      }
      try {
        const subs = await getSubCategories(selectedCategoryId);
        setSubCategories(subs);
      } catch (error) {
        toast.error("Erreur lors du chargement des sous-catégories");
      }
    }
    loadSubCategories();
  }, [selectedCategoryId]);

  const handleCategoryChange = (value: string) => {
    setSelectedCategoryId(value);
    form.setValue("category_id", value);
    form.setValue("sub_category_id", "");
  };

  const handleCategoryCreated = (category: Category) => {
    if (!category.parent_id) {
      setParentCategories((prev) => [...prev, category]);
    } else if (category.parent_id === selectedCategoryId) {
      setSubCategories((prev) => [...prev, category]);
    }
  };

  const [
    { files, isDragging, errors },
    {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      removeFile,
      getInputProps,
      clearFiles,
    },
  ] = useFileUpload({
    accept: "image/png,image/jpeg,image/jpg",
    maxSize: 5 * 1024 * 1024,
    multiple: false,
    maxFiles: 1,
  });

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);

    try {
      // Upload de l'image si présente
      let imageUrl = existingImageUrl;
      if (files.length > 0 && files[0].file instanceof File) {
        imageUrl = await uploadProductImage(files[0].file);
      }

      // Déterminer la catégorie finale (sous-catégorie ou catégorie parente)
      const finalCategoryId = data.sub_category_id || data.category_id || null;

      const productData = {
        name: data.name,
        sku: data.sku || undefined,
        description: data.description || undefined,
        image_url: imageUrl || undefined,
        price: data.price ? parseFloat(data.price) : undefined,
        stock_current: data.stock_current ? parseInt(data.stock_current) : 0,
        stock_min: data.stock_min ? parseInt(data.stock_min) : 10,
        stock_max: data.stock_max ? parseInt(data.stock_max) : 100,
        category_id: finalCategoryId,
        supplier_name: data.supplier_name || undefined,
        is_perishable: data.is_perishable,
        track_stock: data.track_stock,
      };

      if (mode === "edit" && initialData?.id) {
        await updateProduct(initialData.id, productData);
        toast.success("Produit mis à jour avec succès");
        router.push(`/product/${initialData.id}`);
      } else {
        await createProduct(productData);
        toast.success("Produit créé avec succès");
        router.push("/product");
      }
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : mode === "edit"
            ? "Erreur lors de la mise à jour"
            : "Erreur lors de la création"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleCancel = () => {
    if (mode === "edit" && initialData?.id) {
      router.push(`/product/${initialData.id}`);
    } else {
      router.push("/product");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="mb-4 flex items-center justify-between space-y-2">
          <div className="flex items-center gap-4">
            <Button variant="outline" asChild type="button">
              <Link href="/product">
                <ChevronLeft />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">
              {mode === "edit" ? "Modifier le produit" : "Ajouter un produit"}
            </h1>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {mode === "edit" ? "Enregistrer" : "Publier"}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
          <div className="space-y-4 lg:col-span-4">
            <Card>
              <CardHeader>
                <CardTitle>Détails du produit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
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
                  <div className="grid gap-4 lg:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="sku"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SKU</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Auto-généré si vide"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Laissez vide pour générer automatiquement
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prix unitaire (€)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                            />
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
                          <Textarea
                            placeholder="Description du produit..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Image du produit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {existingImageUrl && files.length === 0 && (
                    <div className="relative mb-4">
                      <img
                        src={existingImageUrl}
                        alt="Image actuelle"
                        className="h-40 w-40 rounded-lg object-cover"
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
                    className="border-input data-[dragging=true]:bg-accent/50 has-[input:focus]:border-ring has-[input:focus]:ring-ring/50 relative flex min-h-40 flex-col items-center overflow-hidden rounded-xl border border-dashed p-4 transition-colors not-data-[files]:justify-center has-[input:focus]:ring-[3px]"
                  >
                    <input
                      {...getInputProps()}
                      className="sr-only"
                      aria-label="Upload image file"
                    />
                    {files.length > 0 ? (
                      <div className="flex w-full flex-col gap-3">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="truncate text-sm font-medium">
                            Nouvelle image
                          </h3>
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
                              className="bg-accent relative aspect-square w-40 rounded-md border"
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
                      <div className="flex flex-col items-center justify-center px-4 py-3 text-center">
                        <div
                          className="bg-background mb-2 flex size-11 shrink-0 items-center justify-center rounded-full border"
                          aria-hidden="true"
                        >
                          <ImageIcon className="size-4 opacity-60" />
                        </div>
                        <p className="mb-1.5 text-sm font-medium">
                          Déposez votre image ici
                        </p>
                        <p className="text-muted-foreground text-xs">
                          PNG ou JPG (max. 5MB)
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          className="mt-4"
                          onClick={openFileDialog}
                        >
                          <UploadIcon
                            className="-ms-1 opacity-60"
                            aria-hidden="true"
                          />
                          Sélectionner une image
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fournisseur</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="supplier_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom du fournisseur</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Leroy Merlin" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Niveau de stock</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
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
                  <FormField
                    name="stock_max"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Niveau de stock optimum</FormLabel>
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
                        <FormLabel>Niveau critique (minimum)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} />
                        </FormControl>
                        <FormDescription>
                          Alerte si le stock descend en dessous
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="is_perishable"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Ce produit est périssable</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  <hr />
                  <FormField
                    control={form.control}
                    name="track_stock"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel>Activer le suivi du stock</FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Catégories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <FormField
                    name="category_id"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Catégorie principale</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <div className="grow">
                              <Select
                                value={field.value}
                                onValueChange={handleCategoryChange}
                                disabled={isLoadingCategories}
                              >
                                <SelectTrigger className="w-full">
                                  {isLoadingCategories ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    <SelectValue placeholder="Sélectionnez une catégorie" />
                                  )}
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    {parentCategories.map((cat) => (
                                      <SelectItem key={cat.id} value={cat.id}>
                                        {cat.name}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </div>
                            <AddNewCategory
                              onCategoryCreated={handleCategoryCreated}
                              isSubCategory={false}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="sub_category_id"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sous-catégorie</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <div className="grow">
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={!selectedCategoryId}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue
                                    placeholder={
                                      selectedCategoryId
                                        ? "Sélectionnez une sous-catégorie"
                                        : "Sélectionnez d'abord une catégorie"
                                    }
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    {subCategories.map((cat) => (
                                      <SelectItem key={cat.id} value={cat.id}>
                                        {cat.name}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </div>
                            <AddNewCategory
                              parentCategories={parentCategories}
                              onCategoryCreated={handleCategoryCreated}
                              isSubCategory={true}
                              defaultParentId={selectedCategoryId}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </Form>
  );
}
