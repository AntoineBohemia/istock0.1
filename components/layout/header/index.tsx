"use client";

import * as React from "react";
import { useState } from "react";
import { PanelLeftIcon, ScanLine } from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import Search from "@/components/layout/header/search";
import UserMenu from "@/components/layout/header/user-menu";
import ThemeSwitch from "@/components/layout/header/theme-switch";
// import Notifications from "@/components/layout/header/notifications";
import { Button } from "@/components/ui/button";
import ScanDrawer from "@/components/scan-drawer";
//import { ThemeCustomizerPanel } from "@/components/theme-customizer";

export default function Header() {
  const { toggleSidebar } = useSidebar();
  const [isScanOpen, setIsScanOpen] = useState(false);

  return (
    <div className="sticky top-0 z-50 flex flex-col">
      <header className="bg-background/50 flex h-14 items-center gap-3 px-4 backdrop-blur-xl lg:h-[60px]">
        <Button
          onClick={toggleSidebar}
          size="icon"
          variant="outline"
          className="flex md:hidden lg:flex"
        >
          <PanelLeftIcon />
        </Button>
        <Search />
        <Button
          onClick={() => setIsScanOpen(true)}
          size="icon"
          variant="outline"
          className="sm:hidden"
        >
          <ScanLine className="size-5" />
          <span className="sr-only">Scanner un QR code</span>
        </Button>
        <ScanDrawer open={isScanOpen} onOpenChange={setIsScanOpen} />
        {/* <Notifications /> */}
        {/*<ThemeCustomizerPanel />*/}
        <ThemeSwitch />
        <UserMenu />
      </header>
    </div>
  );
}
