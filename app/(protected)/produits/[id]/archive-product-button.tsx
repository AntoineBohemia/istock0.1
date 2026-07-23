"use client";

import ArchiveButton from "@/components/archive-button";
import { archiveProduct } from "@/lib/supabase/queries/products";

interface ArchiveProductButtonProps {
  productId: string;
  productName: string;
  /** Unités encore comptées au moment de l'archivage */
  stockCount?: number;
}

/**
 * Archivage d'un produit, avec son motif.
 *
 * On n'archive qu'a stock nul. Archiver ne vide pas le stock : le permettre
 * avec des unites restantes sortait la fiche du catalogue en laissant ses
 * unites comptees dans les totaux, sans plus aucun ecran pour les voir ni les
 * corriger. Videz d'abord (sortie ou perte), puis archivez.
 *
 * Le motif est demande dans les deux cas — la question posee six mois plus tard
 * est la meme : pourquoi cette fiche n'est-elle plus la ?
 */
export default function ArchiveProductButton({
  productId,
  productName,
  stockCount = 0,
}: ArchiveProductButtonProps) {
  return (
    <ArchiveButton
      entityLabel="le produit"
      entityName={productName}
      requireReason
      reasonPlaceholder="Référence remplacée, fournisseur arrêté, plus utilisé sur nos chantiers…"
      blockedReason={
        stockCount > 0
          ? `Impossible d'archiver : il reste ${stockCount} unité${stockCount > 1 ? "s" : ""} en stock. Videz-le d'abord (sortie ou perte).`
          : undefined
      }
      onArchive={(reason) => archiveProduct(productId, { reason })}
      redirectTo="/produits"
    />
  );
}
