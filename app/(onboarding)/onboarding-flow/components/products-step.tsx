"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOnboardingStore, ProductData } from "../store";
import { Package, Loader2, Plus, X, Info, Check, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const emptyProduct: Omit<ProductData, "id"> = {
  name: "",
  sku: "",
  categoryId: "",
  stockMin: 5,
  stockMax: 100,
  stockInitial: 0,
  price: 0,
};

export function ProductsStep() {
  const {
    data,
    addProduct,
    removeProduct,
    updateProduct,
    setProductId,
    nextStep,
    prevStep,
    skipStep,
    markStepCompleted,
    isLoading,
    setLoading,
  } = useOnboardingStore();

  const [currentProduct, setCurrentProduct] = useState<Omit<ProductData, "id">>(emptyProduct);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  const handleChange = (field: keyof ProductData, value: string | number) => {
    setCurrentProduct((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddProduct = () => {
    if (!currentProduct.name.trim()) {
      toast.error("Le nom du produit est requis");
      return;
    }

    if (editingIndex !== null) {
      updateProduct(editingIndex, currentProduct);
      setEditingIndex(null);
      toast.success("Produit modifie");
    } else {
      addProduct(currentProduct as ProductData);
      toast.success("Produit ajoute");
    }

    setCurrentProduct(emptyProduct);
    setIsDialogOpen(false);
  };

  const handleEditProduct = (index: number) => {
    const product = data.products[index];
    setCurrentProduct({
      name: product.name,
      sku: product.sku,
      categoryId: product.categoryId,
      stockMin: product.stockMin,
      stockMax: product.stockMax,
      stockInitial: product.stockInitial,
      price: product.price,
    });
    setEditingIndex(index);
    setIsDialogOpen(true);
  };

  const handleOpenDialog = () => {
    setCurrentProduct(emptyProduct);
    setEditingIndex(null);
    setIsDialogOpen(true);
  };

  const handleSaveAll = async () => {
    if (data.products.length === 0) {
      toast.error("Ajoutez au moins un produit");
      return;
    }

    if (!data.createdOrganizationId) {
      toast.error("Organisation non trouvee");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      for (let i = 0; i < data.products.length; i++) {
        const product = data.products[i];
        if (!product.id) {
          setSavingIndex(i);

          const { data: created, error } = await supabase
            .from("products")
            .insert({
              organization_id: data.createdOrganizationId,
              name: product.name.trim(),
              sku: product.sku?.trim() || null,
              category_id: product.categoryId || null,
              stock_min: product.stockMin,
              stock_max: product.stockMax,
              stock_current: product.stockInitial,
              price: product.price || null,
            })
            .select()
            .single();

          if (error) throw error;

          // Create initial stock movement if needed
          if (product.stockInitial > 0) {
            await supabase.from("stock_movements").insert({
              organization_id: data.createdOrganizationId,
              product_id: created.id,
              quantity: product.stockInitial,
              movement_type: "entry",
              notes: "Stock initial (onboarding)",
            });
          }

          setProductId(i, created.id);
        }
      }

      markStepCompleted("products");
      toast.success(`${data.products.length} produit(s) cree(s) !`);
      nextStep();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur lors de la creation";
      toast.error(message);
    } finally {
      setLoading(false);
      setSavingIndex(null);
    }
  };

  const handleSkip = () => {
    skipStep();
    toast.info("Vous pourrez ajouter des produits plus tard");
  };

  const getCategoryName = (categoryId: string) => {
    const category = data.categories.find((c) => c.id === categoryId);
    return category?.name || "Sans categorie";
  };

  const isValid = currentProduct.name.trim().length >= 2;

  return (
    <div className="space-y-8">
      <div className="flex gap-3">
        <div className="bg-primary flex size-10 items-center justify-center rounded-full">
          <Package className="text-primary-foreground size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Ajoutez vos produits</h1>
          <p className="text-muted-foreground">
            Ajoutez les produits que vous souhaitez gerer dans votre stock
          </p>
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 flex gap-3">
        <Info className="size-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium">Conseil</p>
          <p className="text-muted-foreground">
            Commencez par vos produits les plus utilises. Vous pourrez en ajouter d'autres plus tard.
          </p>
        </div>
      </div>

      {/* Products list */}
      {data.products.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Produits ajoutes ({data.products.length})</Label>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
            {data.products.map((product, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border bg-background",
                  product.id && "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20"
                )}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {savingIndex === index ? (
                    <Loader2 className="size-4 animate-spin text-muted-foreground shrink-0" />
                  ) : product.id ? (
                    <Check className="size-4 text-green-600 shrink-0" />
                  ) : (
                    <Package className="size-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {product.categoryId ? getCategoryName(product.categoryId) : "Sans categorie"}
                      {product.sku && ` - ${product.sku}`}
                      {" - Stock: "}{product.stockInitial}
                    </p>
                  </div>
                </div>
                {!product.id && (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditProduct(index)}
                      className="size-8 text-muted-foreground"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeProduct(index)}
                      className="size-8 text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add product button */}
      <Button
        variant="outline"
        onClick={handleOpenDialog}
        className="w-full border-dashed"
      >
        <Plus className="size-4 mr-2" />
        Ajouter un produit
      </Button>

      {/* Product dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? "Modifier le produit" : "Ajouter un produit"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="product-name">Nom du produit *</Label>
              <Input
                id="product-name"
                placeholder="Ex: Peinture Blanche Mat 10L"
                value={currentProduct.name}
                onChange={(e) => handleChange("name", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="product-sku">Reference / SKU</Label>
                <Input
                  id="product-sku"
                  placeholder="Ex: PBM-10L-001"
                  value={currentProduct.sku}
                  onChange={(e) => handleChange("sku", e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label>Categorie</Label>
                <Select
                  value={currentProduct.categoryId}
                  onValueChange={(value) => handleChange("categoryId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {data.categories.length === 0 ? (
                      <SelectItem value="" disabled>
                        Aucune categorie
                      </SelectItem>
                    ) : (
                      data.categories.map((cat) => (
                        <SelectItem key={cat.id || cat.name} value={cat.id || ""}>
                          {cat.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="stock-initial">Stock initial</Label>
                <Input
                  id="stock-initial"
                  type="number"
                  min={0}
                  value={currentProduct.stockInitial}
                  onChange={(e) => handleChange("stockInitial", parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="stock-min">Stock min</Label>
                <Input
                  id="stock-min"
                  type="number"
                  min={0}
                  value={currentProduct.stockMin}
                  onChange={(e) => handleChange("stockMin", parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="stock-max">Stock max</Label>
                <Input
                  id="stock-max"
                  type="number"
                  min={1}
                  value={currentProduct.stockMax}
                  onChange={(e) => handleChange("stockMax", parseInt(e.target.value) || 100)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="price">Prix unitaire (EUR)</Label>
              <Input
                id="price"
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={currentProduct.price || ""}
                onChange={(e) => handleChange("price", parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddProduct} disabled={!isValid}>
              {editingIndex !== null ? "Modifier" : "Ajouter"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex justify-between">
        <Button variant="outline" onClick={prevStep}>
          Retour
        </Button>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={handleSkip}>
            Passer cette etape
          </Button>
          <Button
            size="lg"
            onClick={handleSaveAll}
            disabled={data.products.length === 0 || isLoading}
          >
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Enregistrer ({data.products.length})
          </Button>
        </div>
      </div>
    </div>
  );
}
