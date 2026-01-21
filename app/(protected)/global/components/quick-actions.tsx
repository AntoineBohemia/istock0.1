"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, Package, Scan } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import QrScannerModal from "@/components/qr-scanner-modal";
import QuickStockMovementModal from "@/components/quick-stock-movement-modal";

export function QuickActions() {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedProductId, setScannedProductId] = useState<string | null>(null);
  const [movementModalOpen, setMovementModalOpen] = useState(false);

  const handleScan = (productId: string) => {
    setIsScannerOpen(false);
    setScannedProductId(productId);
    setMovementModalOpen(true);
  };

  const handleCloseModal = () => {
    setMovementModalOpen(false);
    setScannedProductId(null);
  };

  return (
    <>
      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-auto flex-col gap-1 py-3"
              onClick={() => setIsScannerOpen(true)}
            >
              <Scan className="size-5" />
              <span className="text-xs">Scanner</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-1 py-3"
              asChild
            >
              <Link href="/stock">
                <Package className="size-5" />
                <span className="text-xs">Mouvement</span>
              </Link>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-1 py-3"
              asChild
            >
              <Link href="/product">
                <ArrowDownToLine className="size-5 text-green-600" />
                <span className="text-xs">Produits</span>
              </Link>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-1 py-3"
              asChild
            >
              <Link href="/orders">
                <ArrowUpFromLine className="size-5 text-blue-600" />
                <span className="text-xs">Historique</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <QrScannerModal
        open={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScan}
      />

      <QuickStockMovementModal
        open={movementModalOpen}
        onClose={handleCloseModal}
        productId={scannedProductId}
      />
    </>
  );
}
