"use client";

import { useState } from "react";
import { PlusCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCategory, Category } from "@/lib/supabase/queries/categories";
import { toast } from "sonner";

interface AddNewCategoryProps {
  parentCategories?: Category[];
  onCategoryCreated?: (category: Category) => void;
  isSubCategory?: boolean;
  defaultParentId?: string;
}

export default function AddNewCategory({
  parentCategories = [],
  onCategoryCreated,
  isSubCategory = false,
  defaultParentId,
}: AddNewCategoryProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | undefined>(defaultParentId);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Le nom de la catégorie est requis");
      return;
    }

    setIsLoading(true);

    try {
      const newCategory = await createCategory(
        name.trim(),
        isSubCategory ? parentId : null
      );
      toast.success(`Catégorie "${newCategory.name}" créée avec succès`);
      onCategoryCreated?.(newCategory);
      setName("");
      setParentId(defaultParentId);
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de la création de la catégorie"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" type="button">
          <PlusCircle />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isSubCategory ? "Nouvelle sous-catégorie" : "Nouvelle catégorie"}
            </DialogTitle>
            <DialogDescription>
              {isSubCategory
                ? "Ajoutez une nouvelle sous-catégorie à votre catalogue."
                : "Ajoutez une nouvelle catégorie principale à votre catalogue."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nom</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Peintures"
                disabled={isLoading}
              />
            </div>
            {isSubCategory && parentCategories.length > 0 && (
              <div className="grid gap-2">
                <Label htmlFor="parent">Catégorie parente</Label>
                <Select
                  value={parentId}
                  onValueChange={setParentId}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez une catégorie" />
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
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
