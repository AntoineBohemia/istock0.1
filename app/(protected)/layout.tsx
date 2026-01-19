import React from "react";
import { cookies } from "next/headers";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import ScanFab from "@/components/scan-fab";
import OrganizationProvider from "@/components/organization-provider";
import { MeshGradientBg } from "@/components/ui/mesh-gradient-bg";

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
    <OrganizationProvider>
      <MeshGradientBg />
      <SidebarProvider defaultOpen={defaultOpen}>
        <Sidebar />
        <SidebarInset>
          <Header />
          <div className="@container/main p-4 xl:group-data-[theme-content-layout=centered]/layout:container xl:group-data-[theme-content-layout=centered]/layout:mx-auto xl:group-data-[theme-content-layout=centered]/layout:mt-8">
            {children}
          </div>
        </SidebarInset>
        <ScanFab />
      </SidebarProvider>
    </OrganizationProvider>
  );
}
