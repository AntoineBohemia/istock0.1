"use client";

import { useState } from "react";
import { ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import StockEntryModal from "@/components/stock-entry-modal";

interface RestockButtonProps {
  productId: string;
}

export default function RestockButton({ productId }: RestockButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="sm:size-default"
        onClick={() => setIsModalOpen(true)}
      >
        <ArrowDownToLine className="size-4" />
        <span className="hidden sm:inline">Restocker</span>
      </Button>

      <StockEntryModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        productId={productId}
      />
    </>
  );
}
