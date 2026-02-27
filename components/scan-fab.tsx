"use client";

import { useState } from "react";
import { ScanLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import ScanDrawer from "@/components/scan-drawer";

export default function ScanFab() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-lg sm:hidden"
        size="icon"
      >
        <ScanLine className="size-6" />
        <span className="sr-only">Scanner un QR code</span>
      </Button>

      <ScanDrawer open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
