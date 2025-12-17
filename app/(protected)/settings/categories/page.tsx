"use client";

import React, { useEffect, useState } from "react";
import {
  ChevronRight,
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

import {
  Category,
  CategoryWithChildren,
  getCategoriesTree,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/supabase/queries/categories";
import { useOrganizationStore } from "@/lib/stores/organization-store";

export default function CategoriesPage() {
  const { currentOrganization } = useOrganizationStore();
  const [categories, setCategories] = useState<CategoryWithChildren[]>([]);
  const [parentCategories, setParentCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryParentId, setCategoryParentId] = useState<string>("");
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(
    null
  );

  // Expanded categories for showing subcategories
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

  const loadCategories = async () => {
    if (!currentOrganization) return;
    try {
      const tree = await getCategoriesTree(currentOrganization.id);
      setCategories(tree);
      // Extraire les catégories parentes (niveau 0) de l'arborescence
      setParentCategories(tree.map(({ children, ...cat }) => cat));
    } catch (error) {
      toast.error("Erreur lors du chargement des catégories");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [currentOrganization]);

  const toggleExpanded = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const openCreateDialog = (parentId?: string) => {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryParentId(parentId || "");
    setIsDialogOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryParentId(category.parent_id || "");
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (category: Category) => {
    setCategoryToDelete(category);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!currentOrganization) {
      toast.error("Aucune organisation sélectionnée");
      return;
    }

    if (!categoryName.trim()) {
      toast.error("Le nom de la catégorie est requis");
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingCategory) {
        await updateCategory(
          editingCategory.id,
          categoryName.trim(),
          categoryParentId || null
        );
        toast.success("Catégorie mise à jour avec succès");
      } else {
        await createCategory(
          currentOrganization.id,
          categoryName.trim(),
          categoryParentId || undefined
        );
        toast.success("Catégorie créée avec succès");
      }
      setIsDialogOpen(false);
      loadCategories();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Une erreur est survenue"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;

    setIsSubmitting(true);

    try {
      await deleteCategory(categoryToDelete.id);
      toast.success("Catégorie supprimée avec succès");
      setIsDeleteDialogOpen(false);
      setCategoryToDelete(null);
      loadCategories();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Une erreur est survenue"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCategoryRow = (
    category: CategoryWithChildren,
    level: number = 0
  ): React.ReactNode => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.has(category.id);

    return (
      <React.Fragment key={category.id}>
        <TableRow>
          <TableCell>
            <div
              className="flex items-center gap-2"
              style={{ paddingLeft: `${level * 24}px` }}
            >
              {hasChildren && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => toggleExpanded(category.id)}
                >
                  <ChevronRight
                    className={`size-4 transition-transform ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                  />
                </Button>
              )}
              {!hasChildren && <div className="size-6" />}
              <span className="font-medium">{category.name}</span>
            </div>
          </TableCell>
          <TableCell>
            {level === 0 ? (
              <Badge variant="secondary">Principale</Badge>
            ) : (
              <Badge variant="outline">Sous-catégorie</Badge>
            )}
          </TableCell>
          <TableCell>
            {hasChildren ? (
              <span className="text-muted-foreground">
                {category.children!.length} sous-catégorie(s)
              </span>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
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
                {level === 0 && (
                  <DropdownMenuItem
                    onClick={() => openCreateDialog(category.id)}
                  >
                    <Plus className="mr-2 size-4" />
                    Ajouter sous-catégorie
                  </DropdownMenuItem>
                )}
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
        {isExpanded &&
          hasChildren &&
          category.children!.map((child) => renderCategoryRow(child, level + 1))}
      </React.Fragment>
    );
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
        <Button onClick={() => openCreateDialog()}>
          <Plus className="mr-2 size-4" />
          Nouvelle catégorie
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des catégories</CardTitle>
          <CardDescription>
            {categories.length} catégorie(s) principale(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Sous-catégories</TableHead>
                <TableHead>Date de création</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <div className="text-muted-foreground">
                      Aucune catégorie trouvée.{" "}
                      <Button
                        variant="link"
                        className="px-1"
                        onClick={() => openCreateDialog()}
                      >
                        Créer une catégorie
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((category) => renderCategoryRow(category))
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
            <div className="grid gap-2">
              <Label htmlFor="parent">Catégorie parente (optionnel)</Label>
              <Select
                value={categoryParentId || "none"}
                onValueChange={(value) => setCategoryParentId(value === "none" ? "" : value)}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucune (catégorie principale)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">Aucune (catégorie principale)</SelectItem>
                    {parentCategories
                      .filter((cat) => cat.id !== editingCategory?.id)
                      .map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
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
