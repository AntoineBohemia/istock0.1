"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import QuickStockMovementModal from "@/components/quick-stock-movement-modal";

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
        <Package className="size-4" />
        <span className="hidden sm:inline">Restocker</span>
      </Button>

      <QuickStockMovementModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        productId={productId}
      />
    </>
  );
}
