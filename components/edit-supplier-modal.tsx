"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { useUpdateSupplier } from "@/hooks/mutations/use-supplier-mutations";
import type { Supplier } from "@/lib/supabase/queries/suppliers";

interface EditSupplierModalProps {
  supplier: Supplier;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditSupplierModal({
  supplier,
  open,
  onOpenChange,
}: EditSupplierModalProps) {
  const updateMutation = useUpdateSupplier();

  const [prevId, setPrevId] = useState(supplier.id);
  const [name, setName] = useState(supplier.name);
  const [email, setEmail] = useState(supplier.email ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(supplier.website_url ?? "");

  if (supplier.id !== prevId) {
    setPrevId(supplier.id);
    setName(supplier.name);
    setEmail(supplier.email ?? "");
    setWebsiteUrl(supplier.website_url ?? "");
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    updateMutation.mutate(
      {
        id: supplier.id,
        data: {
          name: name.trim(),
          email: email.trim() || null,
          website_url: websiteUrl.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Fournisseur modifié");
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
          <DialogTitle className="text-base font-semibold">Modifier le fournisseur</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="px-5 py-3 border-t space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nom *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="commandes@fournisseur.com"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Site web
              </label>
              <Input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://www.example.com"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 px-5 py-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={updateMutation.isPending || !name.trim()}>
              {updateMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
