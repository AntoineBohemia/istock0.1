"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import StockEntryModal from "@/components/stock-entry-modal";
import StockExitModal from "@/components/stock-exit-modal";

interface StockActionsProps {
  productId: string;
}

export default function StockActions({ productId }: StockActionsProps) {
  const router = useRouter();
  const [entryOpen, setEntryOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);

  const handleClose = () => {
    setEntryOpen(false);
    setExitOpen(false);
    router.refresh();
  };

  return (
    <>
      {/* Même ordre que la liste produits : entrée puis sortie. */}
      <div className="flex gap-2">
        <Button onClick={() => setEntryOpen(true)}>
          <ArrowDownToLine className="size-4" />
          Entrer en stock
        </Button>
        <Button variant="outline" onClick={() => setExitOpen(true)}>
          <ArrowUpFromLine className="size-4" />
          Sortie de stock
        </Button>
      </div>

      <StockEntryModal open={entryOpen} onClose={handleClose} productId={productId} />
      <StockExitModal open={exitOpen} onClose={handleClose} productId={productId} />
    </>
  );
}
