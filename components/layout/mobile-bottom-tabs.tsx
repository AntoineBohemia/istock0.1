"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, ScanLine, Users, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScanDrawerStore } from "@/lib/stores/scan-drawer-store";

const tabs = [
  { key: "home", label: "Accueil", href: "/global", icon: Home },
  { key: "scan", label: "Scan", href: null, icon: ScanLine },
  { key: "techs", label: "Techs", href: "/users", icon: Users },
  { key: "more", label: "Plus", href: "/more", icon: MoreHorizontal },
] as const;

export default function MobileBottomTabs() {
  const pathname = usePathname();
  const openScanDrawer = useScanDrawerStore((s) => s.setOpen);

  const isActive = (href: string | null) => {
    if (!href) return false;
    if (href === "/global") return pathname === "/global" || pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav className="border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around px-2 py-1">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          const Icon = tab.icon;
          const isScan = tab.key === "scan";

          if (isScan) {
            return (
              <button
                key={tab.key}
                onClick={() => openScanDrawer(true)}
                className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5"
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                  <Icon className="size-5" />
                </div>
                <span className="text-[10px] font-medium text-primary">
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <Link
              key={tab.key}
              href={tab.href!}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 min-w-[56px]",
                active
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <Icon className="size-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
