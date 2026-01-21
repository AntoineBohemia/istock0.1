"use client";

import { useState } from "react";
import Link from "next/link";
import { Package, PlusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import QuickStockMovementModal from "@/components/quick-stock-movement-modal";

export default function ProductHeader() {
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Stock produits</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/product/create">
              <PlusCircle /> Ajouter un produit
            </Link>
          </Button>
          <Button onClick={() => setIsRestockModalOpen(true)}>
            <Package /> Restocker
          </Button>
        </div>
      </div>

      <QuickStockMovementModal
        open={isRestockModalOpen}
        onClose={() => setIsRestockModalOpen(false)}
        productId={null}
      />
    </>
  );
}
