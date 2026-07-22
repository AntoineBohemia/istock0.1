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
 * Le motif etait demande pour un outil mais pas pour un consommable, sans
 * qu'aucune raison ne le justifie : les deux quittent le catalogue de la meme
 * facon, et dans les deux cas la question posee six mois plus tard est la
 * meme — pourquoi cette fiche n'est-elle plus la ?
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
      // Archiver ne vide pas le stock : les unités restent comptées alors que
      // la fiche quitte le catalogue. Le dire avant plutôt que de le laisser
      // découvrir dans un total.
      warning={
        stockCount > 0
          ? `Il reste ${stockCount} unité${stockCount > 1 ? "s" : ""} en stock : elles resteront comptées.`
          : undefined
      }
      onArchive={(reason) => archiveProduct(productId, { reason })}
      redirectTo="/produits"
    />
  );
}
