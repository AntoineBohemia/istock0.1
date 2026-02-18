"use client";

import React, { useState } from "react";
import {
  Edit2,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Category } from "@/lib/supabase/queries/categories";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useCategories } from "@/hooks/queries";
import { useCreateCategory, useUpdateCategory, useDeleteCategory } from "@/hooks/mutations";

export default function CategoriesPage() {
  const { currentOrganization } = useOrganizationStore();
  const { data: categories = [], isLoading } = useCategories(currentOrganization?.id);
  const createCategoryMutation = useCreateCategory();
  const updateCategoryMutation = useUpdateCategory();
  const deleteCategoryMutation = useDeleteCategory();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Form states
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  const isSubmitting = createCategoryMutation.isPending || updateCategoryMutation.isPending || deleteCategoryMutation.isPending;

  const openCreateDialog = () => {
    setEditingCategory(null);
    setCategoryName("");
    setIsDialogOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (category: Category) => {
    setCategoryToDelete(category);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!currentOrganization) {
      toast.error("Aucune organisation sélectionnée");
      return;
    }

    if (!categoryName.trim()) {
      toast.error("Le nom de la catégorie est requis");
      return;
    }

    if (editingCategory) {
      updateCategoryMutation.mutate(
        { id: editingCategory.id, name: categoryName.trim() },
        {
          onSuccess: () => {
            toast.success("Catégorie mise à jour avec succès");
            setIsDialogOpen(false);
          },
          onError: (error) => {
            toast.error(error instanceof Error ? error.message : "Une erreur est survenue");
          },
        }
      );
    } else {
      createCategoryMutation.mutate(
        { organizationId: currentOrganization.id, name: categoryName.trim() },
        {
          onSuccess: () => {
            toast.success("Catégorie créée avec succès");
            setIsDialogOpen(false);
          },
          onError: (error) => {
            toast.error(error instanceof Error ? error.message : "Une erreur est survenue");
          },
        }
      );
    }
  };

  const handleDelete = () => {
    if (!categoryToDelete) return;

    deleteCategoryMutation.mutate(categoryToDelete.id, {
      onSuccess: () => {
        toast.success("Catégorie supprimée avec succès");
        setIsDeleteDialogOpen(false);
        setCategoryToDelete(null);
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Une erreur est survenue");
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catégories</h1>
          <p className="text-muted-foreground">
            Gérez les catégories de produits de votre inventaire
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 size-4" />
          Nouvelle catégorie
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des catégories</CardTitle>
          <CardDescription>
            {categories.length} catégorie(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Date de création</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    <div className="text-muted-foreground">
                      Aucune catégorie trouvée.{" "}
                      <Button
                        variant="link"
                        className="px-1"
                        onClick={openCreateDialog}
                      >
                        Créer une catégorie
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <span className="font-medium">{category.name}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground text-sm">
                        {new Date(category.created_at).toLocaleDateString("fr-FR")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(category)}>
                            <Edit2 className="mr-2 size-4" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openDeleteDialog(category)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 size-4" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Modifier la catégorie" : "Nouvelle catégorie"}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? "Modifiez les informations de la catégorie."
                : "Créez une nouvelle catégorie pour organiser vos produits."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nom</Label>
              <Input
                id="name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Ex: Peintures"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editingCategory ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la catégorie</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer la catégorie &quot;
              {categoryToDelete?.name}&quot; ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
