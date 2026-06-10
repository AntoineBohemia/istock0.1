"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import MobileBottomTabs from "./mobile-bottom-tabs";
import { useScanDrawerStore } from "@/lib/stores/scan-drawer-store";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useProducts } from "@/hooks/queries";

const ScanDrawer = dynamic(() => import("@/components/scan-drawer"), { ssr: false });
const QrScannerModal = dynamic(() => import("@/components/qr-scanner-modal"), { ssr: false });
const ScanActionSheet = dynamic(() => import("@/components/scan-action-sheet"), { ssr: false });
const QuickStockMovementModal = dynamic(() => import("@/components/quick-stock-movement-modal"), {
  ssr: false,
});

export default function MobileBottomBar() {
  const {
    open: scanDrawerOpen,
    setOpen: setScanDrawerOpen,
    preselectedTechnicianId,
  } = useScanDrawerStore();
  const { currentOrganization } = useOrganizationStore();

  // Universal scanner state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [scannedProductId, setScannedProductId] = useState<string | null>(null);

  // Fetch products for action sheet display
  const { data: productsResult } = useProducts({
    organizationId: currentOrganization?.id,
    pageSize: 1000,
  });

  const scannedProduct = scannedProductId
    ? (productsResult?.products || []).find((p) => p.id === scannedProductId)
    : null;

  const scannedProductData = scannedProduct
    ? {
        id: scannedProduct.id,
        name: scannedProduct.name,
        sku: scannedProduct.sku,
        icon_name: scannedProduct.icon_name ?? null,
        icon_color: scannedProduct.icon_color ?? null,
        image_url: scannedProduct.image_url,
        stock_current: scannedProduct.stock_current,
      }
    : null;

  // Called from mobile bottom tabs
  const handleScanPress = useCallback(() => {
    setScannerOpen(true);
  }, []);

  // After QR code is scanned successfully
  const handleScanResult = useCallback((productId: string) => {
    setScannerOpen(false);
    setScannedProductId(productId);
    setActionSheetOpen(true);
  }, []);

  // Action: stock exit
  const handleStockExit = useCallback((productId: string) => {
    setScannedProductId(productId);
    setStockModalOpen(true);
  }, []);

  // Action: technician restock
  const handleTechnicianRestock = useCallback(
    (productId: string) => {
      setScannedProductId(productId);
      // Open the restock drawer — the product will be auto-added once technician is selected
      setScanDrawerOpen(true);
    },
    [setScanDrawerOpen]
  );

  const handleStockModalClose = useCallback(() => {
    setStockModalOpen(false);
    setScannedProductId(null);
  }, []);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
      <MobileBottomTabs onScanPress={handleScanPress} />

      {/* Universal QR scanner */}
      <QrScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScanResult}
      />

      {/* Action sheet after scan */}
      <ScanActionSheet
        open={actionSheetOpen}
        onOpenChange={setActionSheetOpen}
        product={scannedProductData}
        onStockExit={handleStockExit}
        onTechnicianRestock={handleTechnicianRestock}
      />

      {/* Quick stock movement modal (for stock exit) */}
      <QuickStockMovementModal
        open={stockModalOpen}
        onClose={handleStockModalClose}
        productId={scannedProductId}
        defaultDirection="exit"
      />

      {/* Existing restock drawer (for technician restock) */}
      <ScanDrawer
        open={scanDrawerOpen}
        onOpenChange={setScanDrawerOpen}
        preselectedTechnicianId={preselectedTechnicianId}
      />
    </div>
  );
}
