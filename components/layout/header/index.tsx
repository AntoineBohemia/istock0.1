"use client";

import { PanelLeftIcon } from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import ThemeSwitch from "@/components/layout/header/theme-switch";
import { Button } from "@/components/ui/button";

export default function Header() {
  const { toggleSidebar } = useSidebar();

  return (
    <div className="sticky top-0 z-50 hidden flex-col md:flex">
      <header className="bg-background/50 flex h-14 items-center gap-3 px-4 backdrop-blur-xl lg:h-[60px]">
        <Button
          onClick={toggleSidebar}
          size="icon"
          variant="outline"
          className="flex bg-card md:hidden lg:flex"
        >
          <PanelLeftIcon />
        </Button>
        <div className="flex-1" />
        <ThemeSwitch />
      </header>
    </div>
  );
}
