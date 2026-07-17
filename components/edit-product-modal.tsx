"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useCategories, useSuppliers } from "@/hooks/queries";
import { useUpdateProduct } from "@/hooks/mutations";
import { ProductWithRelations } from "@/lib/supabase/queries/products";

interface EditProductModalProps {
  product: ProductWithRelations;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditProductModal({ product, open, onOpenChange }: EditProductModalProps) {
  const { currentOrganization } = useOrganizationStore();
  const { data: categories = [] } = useCategories(currentOrganization?.id);
  const { data: suppliers = [] } = useSuppliers(currentOrganization?.id);
  const updateMutation = useUpdateProduct();

  const [prevId, setPrevId] = useState(product.id);
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [price, setPrice] = useState(product.price?.toString() ?? "");
  const [stockMin, setStockMin] = useState(product.stock_min?.toString() ?? "0");
  const [categoryId, setCategoryId] = useState(product.category_id ?? "");
  const [supplierId, setSupplierId] = useState(product.supplier_id ?? "");

  if (product.id !== prevId) {
    setPrevId(product.id);
    setName(product.name);
    setDescription(product.description ?? "");
    setPrice(product.price?.toString() ?? "");
    setStockMin(product.stock_min?.toString() ?? "0");
    setCategoryId(product.category_id ?? "");
    setSupplierId(product.supplier_id ?? "");
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    updateMutation.mutate(
      {
        id: product.id,
        data: {
          name: name.trim(),
          description: description.trim() || null,
          price: price ? parseFloat(price) : null,
          stock_min: stockMin ? parseInt(stockMin) : 0,
          category_id: categoryId || null,
          supplier_id: supplierId || null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Produit modifie");
          onOpenChange(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 p-0 flex flex-col max-h-[85vh]">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-semibold">Modifier le produit</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-5 py-3 border-t space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nom *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                className="bg-white dark:bg-card"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Description
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optionnelle"
                rows={2}
                className="bg-white dark:bg-card resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Prix HT
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  className="bg-white dark:bg-card"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Seuil critique
                </label>
                <Input
                  type="number"
                  min={0}
                  value={stockMin}
                  onChange={(e) => setStockMin(e.target.value)}
                  className="bg-white dark:bg-card"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Categorie
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="border-input bg-white dark:bg-card text-sm flex h-9 w-full rounded-md border px-3 py-1.5 outline-none focus:border-foreground/30 focus:ring-foreground/10 focus:ring-[3px]"
              >
                <option value="">Sans categorie</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Fournisseur
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="border-input bg-white dark:bg-card text-sm flex h-9 w-full rounded-md border px-3 py-1.5 outline-none focus:border-foreground/30 focus:ring-foreground/10 focus:ring-[3px]"
              >
                <option value="">Sans fournisseur</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 px-5 py-4 border-t">
            <div className="flex-1" />
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
              className="h-10 bg-white dark:bg-card"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending || !name.trim()}
              className="h-10"
            >
              {updateMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
