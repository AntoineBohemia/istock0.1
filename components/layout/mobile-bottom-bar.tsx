"use client";

import MobileBottomTabs from "./mobile-bottom-tabs";
import ScanDrawer from "@/components/scan-drawer";
import { useScanDrawerStore } from "@/lib/stores/scan-drawer-store";

export default function MobileBottomBar() {
  const { open: scanOpen, setOpen: setScanOpen, preselectedTechnicianId } = useScanDrawerStore();

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
      <MobileBottomTabs />

      <ScanDrawer
        open={scanOpen}
        onOpenChange={setScanOpen}
        preselectedTechnicianId={preselectedTechnicianId}
      />
    </div>
  );
}
