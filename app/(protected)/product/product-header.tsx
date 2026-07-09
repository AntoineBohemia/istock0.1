"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import QuickStockMovementModal from "@/components/quick-stock-movement-modal";

export default function ProductHeader() {
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Stock produits</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsExitModalOpen(true)}>
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
