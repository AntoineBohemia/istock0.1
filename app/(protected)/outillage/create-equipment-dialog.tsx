"use client";

import { useState } from "react";
import { AlertCircle, ImageIcon, Loader2, X } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useCreateProduct } from "@/hooks/mutations";
import { generateSKU, uploadProductImage } from "@/lib/supabase/queries/products";
import { useFileUpload } from "@/hooks/use-file-upload";

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
  const [isUploading, setIsUploading] = useState(false);

  const [
    { files, isDragging, errors: fileErrors },
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
  });

  if (open && !prevOpen) {
    setName("");
    setDescription("");
    setStockCurrent(1);
    setPrice("");
    clearFiles();
  }
  if (open !== prevOpen) setPrevOpen(open);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !currentOrganization?.id) return;

    let imageUrl: string | undefined;
    if (files.length > 0 && files[0].file instanceof File) {
      try {
        setIsUploading(true);
        imageUrl = await uploadProductImage(files[0].file);
      } catch {
        toast.error("Erreur lors de l'upload de l'image");
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }

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
        image_url: imageUrl || null,
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
            {/* Image upload */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Photo</label>
              {files.length > 0 ? (
                <div className="relative w-full h-28 rounded-lg border overflow-hidden bg-muted">
                  <img src={files[0].preview} alt="Preview" className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => clearFiles()}
                    className="absolute top-1.5 right-1.5 size-6 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <div
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  data-dragging={isDragging || undefined}
                  className="flex flex-col items-center justify-center h-28 rounded-lg border border-dashed data-[dragging=true]:bg-accent/50 transition-colors cursor-pointer"
                  onClick={openFileDialog}
                >
                  <input {...getInputProps()} className="sr-only" />
                  <ImageIcon className="size-5 text-muted-foreground/60 mb-1.5" />
                  <p className="text-xs text-muted-foreground">PNG ou JPG (max. 5MB)</p>
                </div>
              )}
              {fileErrors.length > 0 && (
                <p className="text-destructive flex items-center gap-1 text-xs mt-1">
                  <AlertCircle className="size-3 shrink-0" />
                  {fileErrors[0]}
                </p>
              )}
            </div>

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
              disabled={createMutation.isPending || isUploading || !name.trim()}
              className="h-10"
            >
              {(createMutation.isPending || isUploading) && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Ajouter
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
