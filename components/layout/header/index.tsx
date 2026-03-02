"use client";

import * as React from "react";
import { PanelLeftIcon, ClipboardList } from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import Search from "@/components/layout/header/search";
import UserMenu from "@/components/layout/header/user-menu";
import ThemeSwitch from "@/components/layout/header/theme-switch";
// import Notifications from "@/components/layout/header/notifications";
import { Button } from "@/components/ui/button";
import { useTaskDrawerStore } from "@/lib/stores/task-drawer-store";
//import { ThemeCustomizerPanel } from "@/components/theme-customizer";

export default function Header() {
  const { toggleSidebar } = useSidebar();
  const openTaskDrawer = useTaskDrawerStore((s) => s.setOpen);

  return (
    <div className="sticky top-0 z-50 hidden flex-col md:flex">
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
          size="icon"
          variant="outline"
          className="sm:hidden"
          onClick={() => openTaskDrawer(true)}
        >
          <ClipboardList className="size-5" />
          <span className="sr-only">A faire</span>
        </Button>
        {/* <Notifications /> */}
        {/*<ThemeCustomizerPanel />*/}
        <ThemeSwitch />
        <UserMenu />
      </header>
    </div>
  );
}
