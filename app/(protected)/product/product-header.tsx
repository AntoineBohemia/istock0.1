"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, PlusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import QuickStockMovementModal from "@/components/quick-stock-movement-modal";

export default function ProductHeader() {
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Stock produits</h1>
        <div className="flex gap-2">
          <Button variant="ghost" asChild>
            <Link href="/product/create">
              <PlusCircle /> Ajouter un produit
            </Link>
          </Button>
          <Button variant="secondary" onClick={() => setIsExitModalOpen(true)}>
            <ArrowUpFromLine /> Sortir produit
          </Button>
          <Button onClick={() => setIsEntryModalOpen(true)}>
            <ArrowDownToLine /> Entrer produit
          </Button>
        </div>
      </div>

      <QuickStockMovementModal
        open={isEntryModalOpen}
        onClose={() => setIsEntryModalOpen(false)}
        productId={null}
        defaultDirection="entry"
      />
      <QuickStockMovementModal
        open={isExitModalOpen}
        onClose={() => setIsExitModalOpen(false)}
        productId={null}
        defaultDirection="exit"
      />
    </>
  );
}
