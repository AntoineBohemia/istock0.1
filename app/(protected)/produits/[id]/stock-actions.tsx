"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import StockEntryModal from "@/components/stock-entry-modal";
import StockExitModal from "@/components/stock-exit-modal";

interface StockActionsProps {
  productId: string;
}

export default function StockActions({ productId }: StockActionsProps) {
  const [entryOpen, setEntryOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setExitOpen(true)}>
          <ArrowUpFromLine className="size-4" />
          Sortir produit
        </Button>
        <Button onClick={() => setEntryOpen(true)}>
          <ArrowDownToLine className="size-4" />
          Entrer produit
        </Button>
      </div>

      <StockEntryModal
        open={entryOpen}
        onClose={() => setEntryOpen(false)}
        productId={productId}
      />
      <StockExitModal
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        productId={productId}
      />
    </>
  );
}
