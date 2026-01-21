"use client";

import { useState } from "react";
import { ScanLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import QrScannerModal from "@/components/qr-scanner-modal";
import QuickStockMovementModal from "@/components/quick-stock-movement-modal";

export default function ScanFab() {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedProductId, setScannedProductId] = useState<string | null>(null);

  const handleScan = (productId: string) => {
    setScannedProductId(productId);
  };

  const handleMovementClose = () => {
    setScannedProductId(null);
  };

  return (
    <>
      <Button
        onClick={() => setIsScannerOpen(true)}
        className="fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-lg sm:hidden"
        size="icon"
      >
        <ScanLine className="size-6" />
        <span className="sr-only">Scanner un QR code</span>
      </Button>

      <QrScannerModal
        open={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScan}
      />

      <QuickStockMovementModal
        open={scannedProductId !== null}
        onClose={handleMovementClose}
        productId={scannedProductId}
      />
    </>
  );
}
