"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { archiveProduct } from "@/lib/supabase/queries/products";

interface ArchiveProductButtonProps {
  productId: string;
  productName: string;
}

export default function ArchiveProductButton({
  productId,
  productName,
}: ArchiveProductButtonProps) {
  const router = useRouter();
  const [isArchiving, setIsArchiving] = useState(false);
  const [open, setOpen] = useState(false);

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      await archiveProduct(productId);
      toast.success("Produit archivé avec succès");
      router.push("/product");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de l'archivage"
      );
    } finally {
      setIsArchiving(false);
      setOpen(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="icon">
          <Archive />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archiver le produit ?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{productName}</strong> sera archivé et ne sera plus visible
            dans les listes et statistiques.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isArchiving}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleArchive}
            disabled={isArchiving}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isArchiving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Archiver
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
