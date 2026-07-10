"use client";

import ArchiveButton from "@/components/archive-button";
import { archiveProduct } from "@/lib/supabase/queries/products";

interface ArchiveProductButtonProps {
  productId: string;
  productName: string;
}

export default function ArchiveProductButton({
  productId,
  productName,
}: ArchiveProductButtonProps) {
  return (
    <ArchiveButton
      entityLabel="le produit"
      entityName={productName}
      onArchive={() => archiveProduct(productId)}
      redirectTo="/product"
    />
  );
}
