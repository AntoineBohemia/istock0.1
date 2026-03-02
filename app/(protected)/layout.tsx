import React from "react";
import { cookies } from "next/headers";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import MobileTopBar from "@/components/layout/mobile-top-bar";
import MobileBottomBar from "@/components/layout/mobile-bottom-bar";
import OrganizationProvider from "@/components/organization-provider";
import QueryProvider from "@/components/query-provider";

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const defaultOpen =
    cookieStore.get("sidebar_state")?.value === "true" ||
    cookieStore.get("sidebar_state") === undefined;

  return (
    <QueryProvider>
      <OrganizationProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <Sidebar />
          <SidebarInset>
            {/* Desktop header — hidden on mobile */}
            <Header />
            {/* Mobile top bar — hidden on desktop */}
            <MobileTopBar />
            <div className="@container/main p-4 pb-20 md:pb-4 xl:group-data-[theme-content-layout=centered]/layout:container xl:group-data-[theme-content-layout=centered]/layout:mx-auto xl:group-data-[theme-content-layout=centered]/layout:mt-8">
              {children}
            </div>
          </SidebarInset>
          {/* Mobile bottom tabs — hidden on desktop */}
          <MobileBottomBar />
        </SidebarProvider>
      </OrganizationProvider>
    </QueryProvider>
  );
}
