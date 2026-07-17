"use client";

import { useState } from "react";
import { Edit3Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import EditProductModal from "@/components/edit-product-modal";
import { ProductWithRelations } from "@/lib/supabase/queries/products";

export default function EditProductButton({ product }: { product: ProductWithRelations }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline-contrast" onClick={() => setOpen(true)}>
        <Edit3Icon className="size-4" />
        Modifier
      </Button>
      <EditProductModal product={product} open={open} onOpenChange={setOpen} />
    </>
  );
}
