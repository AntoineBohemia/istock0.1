"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import QuickStockMovementModal from "@/components/quick-stock-movement-modal";

interface StockActionsProps {
  productId: string;
}

export default function StockActions({ productId }: StockActionsProps) {
  const [direction, setDirection] = useState<"entry" | "exit">("entry");
  const [isOpen, setIsOpen] = useState(false);

  const open = (dir: "entry" | "exit") => {
    setDirection(dir);
    setIsOpen(true);
  };

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => open("exit")}>
          <ArrowUpFromLine className="size-4" />
          Sortir produit
        </Button>
        <Button onClick={() => open("entry")}>
          <ArrowDownToLine className="size-4" />
          Entrer produit
        </Button>
      </div>

      <QuickStockMovementModal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        productId={productId}
        defaultDirection={direction}
      />
    </>
  );
}
