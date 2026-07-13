"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useTechnicians, useEquipmentProduct } from "@/hooks/queries";
import { useAssignEquipment } from "@/hooks/mutations";
import ProductIconDisplay from "@/components/product-icon-display";

interface AssignEquipmentModalProps {
  productId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AssignEquipmentModal({
  productId,
  open,
  onOpenChange,
}: AssignEquipmentModalProps) {
  const { currentOrganization } = useOrganizationStore();
  const { data: product } = useEquipmentProduct(productId);
  const { data: technicians = [] } = useTechnicians(currentOrganization?.id);
  const assignMutation = useAssignEquipment();

  const [selectedTechId, setSelectedTechId] = useState("");
  const [quantity, setQuantity] = useState(1);

  const maxQty = product?.stock_current ?? 0;

  const handleSubmit = () => {
    if (!selectedTechId || !currentOrganization?.id) return;

    assignMutation.mutate(
      {
        organizationId: currentOrganization.id,
        productId,
        technicianId: selectedTechId,
        quantity,
      },
      {
        onSuccess: () => {
          toast.success("Outil assigné avec succès");
          onOpenChange(false);
          setSelectedTechId("");
          setQuantity(1);
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Erreur lors de l'assignation");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 p-0 flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-semibold">Assigner un outil</DialogTitle>
        </DialogHeader>

        {product && (
          <div className="px-5 py-3 border-t flex items-center gap-3">
            <ProductIconDisplay
              iconName={product.icon_name}
              iconColor={product.icon_color}
              imageUrl={product.image_url}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{product.name}</p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {product.stock_current ?? 0} disponible{(product.stock_current ?? 0) > 1 ? "s" : ""}
              </p>
            </div>
          </div>
        )}

        <div className="px-5 py-3 border-t space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Technicien
            </label>
            <select
              value={selectedTechId}
              onChange={(e) => setSelectedTechId(e.target.value)}
              className="border-input bg-white dark:bg-card text-sm flex h-9 w-full rounded-md border px-3 py-1.5 shadow-xs outline-none focus:border-foreground/30 focus:ring-foreground/10 focus:ring-[3px]"
            >
              <option value="">Sélectionner un technicien...</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.first_name} {t.last_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Quantité
            </label>
            <Input
              type="number"
              min={1}
              max={maxQty}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(parseInt(e.target.value) || 1, maxQty)))}
              className="bg-white dark:bg-card"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 px-5 py-4 border-t">
          <div className="flex-1" />
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={assignMutation.isPending}
            className="h-10 bg-white dark:bg-card"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={assignMutation.isPending || !selectedTechId || maxQty === 0}
            className="h-10"
          >
            {assignMutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Assigner
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
