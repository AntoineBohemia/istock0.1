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
import { createSupplier, Supplier } from "@/lib/supabase/queries/suppliers";
import { toast } from "@/lib/toast";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

interface AddNewSupplierProps {
  onSupplierCreated?: (supplier: Supplier) => void;
  trigger?: React.ReactNode;
}

export default function AddNewSupplier({ onSupplierCreated, trigger }: AddNewSupplierProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { currentOrganization } = useOrganizationStore();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentOrganization) {
      toast.error("Aucune organisation sélectionnée");
      return;
    }

    if (!name.trim()) {
      toast.error("Le nom du fournisseur est requis");
      return;
    }

    setIsLoading(true);

    try {
      const newSupplier = await createSupplier(
        currentOrganization.id,
        name.trim(),
        websiteUrl.trim() || null,
        email.trim() || null
      );
      toast.success(`Fournisseur "${newSupplier.name}" créé avec succès`);
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all });
      onSupplierCreated?.(newSupplier);
      setName("");
      setEmail("");
      setWebsiteUrl("");
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de la création du fournisseur"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="icon" variant="outline" type="button">
            <PlusCircle />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nouveau fournisseur</DialogTitle>
            <DialogDescription>Ajoutez un nouveau fournisseur à votre catalogue.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="supplier-name">Nom *</Label>
              <Input
                id="supplier-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Leroy Merlin"
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplier-email">Email</Label>
              <Input
                id="supplier-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="commandes@fournisseur.com"
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplier-website">Site web</Label>
              <Input
                id="supplier-website"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://www.example.com"
                disabled={isLoading}
              />
            </div>
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
