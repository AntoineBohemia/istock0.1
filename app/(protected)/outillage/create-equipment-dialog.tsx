"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useCreateProduct } from "@/hooks/mutations";
import { generateSKU } from "@/lib/supabase/queries/products";

interface CreateEquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateEquipmentDialog({ open, onOpenChange }: CreateEquipmentDialogProps) {
  const { currentOrganization } = useOrganizationStore();
  const createMutation = useCreateProduct();

  const [prevOpen, setPrevOpen] = useState(open);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stockCurrent, setStockCurrent] = useState(1);
  const [price, setPrice] = useState("");

  if (open && !prevOpen) {
    setName("");
    setDescription("");
    setStockCurrent(1);
    setPrice("");
  }
  if (open !== prevOpen) setPrevOpen(open);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !currentOrganization?.id) return;

    createMutation.mutate(
      {
        organization_id: currentOrganization.id,
        name: name.trim(),
        sku: generateSKU(name),
        description: description.trim() || null,
        category_id: null,
        stock_current: stockCurrent,
        stock_min: 0,
        price: price ? parseFloat(price) : null,
        product_type: "equipment" as any,
      } as any,
      {
        onSuccess: () => {
          toast.success("Outil ajouté");
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Erreur");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 p-0 flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-semibold">Nouvel outil</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="px-5 py-3 border-t space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nom *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Perceuse Bosch GSR 18V"
                required
                autoFocus
                className="bg-white dark:bg-card"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Description
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optionnelle"
                className="bg-white dark:bg-card"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Quantité
                </label>
                <Input
                  type="number"
                  min={0}
                  value={stockCurrent}
                  onChange={(e) => setStockCurrent(parseInt(e.target.value) || 0)}
                  className="bg-white dark:bg-card"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Prix unitaire
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
            </div>
          </div>

          <div className="flex items-center gap-3 px-5 py-4 border-t">
            <div className="flex-1" />
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
              className="h-10 bg-white dark:bg-card"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || !name.trim()}
              className="h-10"
            >
              {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Ajouter
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
