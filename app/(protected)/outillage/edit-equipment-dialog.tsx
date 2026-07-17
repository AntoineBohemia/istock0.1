"use client";

import { useState } from "react";
import { AlertCircle, ImageIcon, Loader2, Upload, X } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { useUpdateProduct } from "@/hooks/mutations";
import { EquipmentProduct } from "@/lib/supabase/queries/equipment";
import { uploadProductImage } from "@/lib/supabase/queries/products";
import { useFileUpload } from "@/hooks/use-file-upload";

interface EditEquipmentDialogProps {
  product: EquipmentProduct;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditEquipmentDialog({
  product,
  open,
  onOpenChange,
}: EditEquipmentDialogProps) {
  const updateMutation = useUpdateProduct();

  // Reset form when product changes (dialog opens with new product)
  const [prevProductId, setPrevProductId] = useState(product.id);
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [price, setPrice] = useState(product.price?.toString() ?? "");
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(
    product.image_url ?? null
  );
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

  if (product.id !== prevProductId) {
    setPrevProductId(product.id);
    setName(product.name);
    setDescription(product.description ?? "");
    setPrice(product.price?.toString() ?? "");
    setExistingImageUrl(product.image_url ?? null);
    clearFiles();
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let imageUrl: string | null = existingImageUrl;
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

    updateMutation.mutate(
      {
        id: product.id,
        data: {
          name: name.trim(),
          description: description.trim() || null,
          price: price ? parseFloat(price) : null,
          image_url: imageUrl,
        },
      },
      {
        onSuccess: () => {
          toast.success("Outil modifie");
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
          <DialogTitle className="text-base font-semibold">Modifier l'outil</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="px-5 py-3 border-t space-y-3">
            {/* Image upload */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Photo</label>
              {existingImageUrl && files.length === 0 ? (
                <div className="relative w-full h-28 rounded-lg border overflow-hidden bg-muted">
                  <img
                    src={existingImageUrl}
                    alt="Image actuelle"
                    className="size-full object-cover"
                  />
                  <div className="absolute top-1.5 right-1.5 flex gap-1">
                    <button
                      type="button"
                      onClick={openFileDialog}
                      className="size-6 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                    >
                      <Upload className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setExistingImageUrl(null)}
                      className="size-6 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <input {...getInputProps()} className="sr-only" />
                </div>
              ) : files.length > 0 ? (
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
              disabled={updateMutation.isPending || isUploading || !name.trim()}
              className="h-10"
            >
              {(updateMutation.isPending || isUploading) && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
