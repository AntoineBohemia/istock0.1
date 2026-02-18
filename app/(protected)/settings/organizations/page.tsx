"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Building2,
  Edit2,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
  Users,
  Crown,
  Upload,
  X,
  ImageIcon,
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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { useOrganizationStore, Organization } from "@/lib/stores/organization-store";
import { useOrganizations } from "@/hooks/queries";
import {
  useCreateOrganization,
  useUpdateOrganization,
  useDeleteOrganization,
  useUploadOrganizationLogo,
} from "@/hooks/mutations";

interface OrganizationWithMeta extends Organization {
  memberCount?: number;
}

export default function OrganizationsPage() {
  const { currentOrganization, setOrganizations, setCurrentOrganization } = useOrganizationStore();
  const { data: organizations = [], isLoading } = useOrganizations();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const createMutation = useCreateOrganization();
  const updateMutation = useUpdateOrganization();
  const deleteMutation = useDeleteOrganization();
  const uploadLogoMutation = useUploadOrganizationLogo();

  const isSubmitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    uploadLogoMutation.isPending;

  // Form states
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [orgToDelete, setOrgToDelete] = useState<Organization | null>(null);

  // Logo states
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync organizations to Zustand store when they change
  useEffect(() => {
    if (organizations.length > 0) {
      setOrganizations(organizations);
    }
  }, [organizations, setOrganizations]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const openCreateDialog = () => {
    setEditingOrg(null);
    setOrgName("");
    setOrgSlug("");
    setLogoFile(null);
    setLogoPreview(null);
    setExistingLogoUrl(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (org: Organization) => {
    setEditingOrg(org);
    setOrgName(org.name);
    setOrgSlug(org.slug);
    setLogoFile(null);
    setLogoPreview(null);
    setExistingLogoUrl(org.logo_url);
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (org: Organization) => {
    setOrgToDelete(org);
    setIsDeleteDialogOpen(true);
  };

  const handleNameChange = (value: string) => {
    setOrgName(value);
    if (!editingOrg) {
      setOrgSlug(generateSlug(value));
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner une image");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 2MB");
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setExistingLogoUrl(null);
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setExistingLogoUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!orgName.trim()) {
      toast.error("Le nom de l'organisation est requis");
      return;
    }

    if (!orgSlug.trim()) {
      toast.error("Le slug est requis");
      return;
    }

    try {
      let logoUrl: string | null | undefined = existingLogoUrl;

      // Upload new logo if selected
      if (logoFile) {
        logoUrl = await uploadLogoMutation.mutateAsync({
          file: logoFile,
          orgSlug: orgSlug.trim(),
        });
      } else if (!existingLogoUrl && editingOrg?.logo_url) {
        // Logo was removed
        logoUrl = null;
      }

      if (editingOrg) {
        await updateMutation.mutateAsync({
          id: editingOrg.id,
          data: {
            name: orgName.trim(),
            slug: orgSlug.trim(),
            logo_url: logoUrl,
          },
        });
        toast.success("Organisation mise à jour");

        // Update current organization if it's the one being edited
        if (currentOrganization?.id === editingOrg.id) {
          setCurrentOrganization({
            ...currentOrganization,
            name: orgName.trim(),
            slug: orgSlug.trim(),
            logo_url: logoUrl || null,
          });
        }
      } else {
        await createMutation.mutateAsync({
          name: orgName.trim(),
          slug: orgSlug.trim(),
          logoUrl: logoUrl || undefined,
        });
        toast.success("Organisation créée");
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Une erreur est survenue"
      );
    }
  };

  const handleDelete = async () => {
    if (!orgToDelete) return;

    if (orgToDelete.id === currentOrganization?.id) {
      toast.error("Vous ne pouvez pas supprimer l'organisation active");
      setIsDeleteDialogOpen(false);
      return;
    }

    try {
      await deleteMutation.mutateAsync(orgToDelete.id);
      toast.success("Organisation supprimée");
      setIsDeleteDialogOpen(false);
      setOrgToDelete(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Une erreur est survenue"
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organisations</h1>
          <p className="text-muted-foreground">
            Gérez vos organisations et leurs paramètres
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 size-4" />
          Nouvelle organisation
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mes organisations</CardTitle>
          <CardDescription>
            {organizations.length} organisation(s) dont vous êtes membre
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisation</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    <div className="text-muted-foreground">
                      Aucune organisation trouvée.{" "}
                      <Button
                        variant="link"
                        className="px-1"
                        onClick={openCreateDialog}
                      >
                        Créer une organisation
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                organizations.map((org) => {
                  const isOwner = org.role === "owner";
                  const isCurrent = org.id === currentOrganization?.id;

                  return (
                    <TableRow key={org.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-10">
                            {org.logo_url ? (
                              <AvatarImage src={org.logo_url} alt={org.name} />
                            ) : null}
                            <AvatarFallback>
                              <Building2 className="size-5" />
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{org.name}</span>
                              {isCurrent && (
                                <Badge variant="secondary" className="text-xs">
                                  Active
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-2 py-1 text-sm">
                          {org.slug}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={isOwner ? "default" : "secondary"}
                          className="gap-1"
                        >
                          {isOwner ? (
                            <Crown className="size-3" />
                          ) : (
                            <Users className="size-3" />
                          )}
                          {org.role === "owner"
                            ? "Propriétaire"
                            : org.role === "admin"
                              ? "Admin"
                              : "Membre"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isOwner && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => openEditDialog(org)}
                              >
                                <Edit2 className="mr-2 size-4" />
                                Modifier
                              </DropdownMenuItem>
                              {!isCurrent && (
                                <DropdownMenuItem
                                  onClick={() => openDeleteDialog(org)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="mr-2 size-4" />
                                  Supprimer
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
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
              {editingOrg ? "Modifier l'organisation" : "Nouvelle organisation"}
            </DialogTitle>
            <DialogDescription>
              {editingOrg
                ? "Modifiez les informations de l'organisation."
                : "Créez une nouvelle organisation pour gérer un espace de données indépendant."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Logo Upload */}
            <div className="grid gap-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="size-16 border-2 border-dashed border-muted-foreground/25">
                    {logoPreview || existingLogoUrl ? (
                      <AvatarImage
                        src={logoPreview || existingLogoUrl || ""}
                        alt="Logo preview"
                      />
                    ) : null}
                    <AvatarFallback className="bg-muted">
                      <ImageIcon className="size-6 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  {(logoPreview || existingLogoUrl) && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -right-2 -top-2 size-6"
                      onClick={removeLogo}
                      disabled={isSubmitting}
                    >
                      <X className="size-3" />
                    </Button>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleLogoChange}
                    className="hidden"
                    disabled={isSubmitting}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting}
                  >
                    <Upload className="mr-2 size-4" />
                    {logoPreview || existingLogoUrl ? "Changer" : "Ajouter un logo"}
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PNG, JPG ou WebP. Max 2MB.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name">Nom de l'organisation</Label>
              <Input
                id="name"
                value={orgName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex: Mon Entreprise"
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slug">Slug (identifiant unique)</Label>
              <Input
                id="slug"
                value={orgSlug}
                onChange={(e) => setOrgSlug(e.target.value)}
                placeholder="mon-entreprise"
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Utilisé dans les URLs. Lettres minuscules, chiffres et tirets
                uniquement.
              </p>
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
              {isSubmitting && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              {uploadLogoMutation.isPending
                ? "Upload du logo..."
                : editingOrg
                  ? "Enregistrer"
                  : "Créer"}
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
            <AlertDialogTitle>Supprimer l'organisation</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer l'organisation &quot;
              {orgToDelete?.name}&quot; ?
              <br />
              <br />
              <strong className="text-destructive">
                Cette action est irréversible et supprimera toutes les données
                associées (produits, techniciens, mouvements de stock, etc.).
              </strong>
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
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
