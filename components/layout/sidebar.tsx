"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { page_routes, filterRoutesByRole } from "@/lib/routes-config";
import { LogOut, Users, Building2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { motion } from "motion/react";

import {
  Sidebar as SidebarContainer,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Icon from "../icon";
import IstockLogo from "@/components/layout/istock-logo";
import { useIsTablet } from "@/hooks/use-mobile";
import { createClient } from "@/lib/supabase/client";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpen, setOpenMobile, isMobile } = useSidebar();
  const isTablet = useIsTablet();

  const { currentOrganization } = useOrganizationStore();

  // User data for footer
  const [user, setUser] = useState<{ name: string; email: string; avatar: string | null } | null>(
    null
  );
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname]);

  useEffect(() => {
    setOpen(!isTablet);
  }, [isTablet]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data: { user: authUser } }) => {
        if (authUser) {
          setUser({
            name:
              authUser.user_metadata?.full_name ||
              authUser.user_metadata?.name ||
              authUser.email?.split("@")[0] ||
              "",
            email: authUser.email || "",
            avatar: authUser.user_metadata?.avatar_url || null,
          });
        }
      })
      .catch(() => {
        // Network error during HMR or cold start — ignore silently
      });
  }, []);

  const initials = user ? (user.name || user.email || "U").slice(0, 2).toUpperCase() : "U";

  // Resolve active item href for layout animation
  const allItems = filterRoutesByRole(page_routes, currentOrganization?.role).flatMap(
    (r) => r.items
  );
  const _activeHref = allItems.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  )?.href;

  return (
    <SidebarContainer collapsible="icon" variant="floating" className="bg-background">
      {/* ── Branding ── */}
      <SidebarHeader className="pt-4 pb-5 transition-all group-data-[collapsible=icon]:pt-4">
        <div className="px-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
          <IstockLogo className="h-5 group-data-[collapsible=icon]:hidden" />
          <img
            src="/logo/istock-app.svg"
            alt="iStock"
            className="hidden size-8 group-data-[collapsible=icon]:block"
          />
        </div>
      </SidebarHeader>

      {/* ── Navigation principale ── */}
      <SidebarContent className="overflow-hidden">
        {filterRoutesByRole(page_routes, currentOrganization?.role).map((route, key) => (
          <SidebarGroup key={key}>
            {route.title && (
              <div className="text-xs tracking-wider uppercase text-muted-foreground px-3 py-1.5">
                {route.title}
              </div>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {route.items.map((item, idx) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <SidebarMenuItem key={idx} className="relative">
                      {/* Animated active background */}
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active"
                          className="absolute inset-0 rounded-md bg-foreground/[0.06]"
                          transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                        />
                      )}
                      <SidebarMenuButton
                        className={`relative z-[1] hover:text-foreground active:text-foreground ${isActive ? "hover:bg-transparent active:bg-transparent" : ""}`}
                        asChild
                        tooltip={item.title}
                        isActive={isActive}
                      >
                        <Link href={item.href}>
                          {item.icon && <Icon name={item.icon} className="size-4" />}
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* ── Footer : Paramètres + Utilisateur ── */}
      <SidebarFooter className="gap-0">
        {user && (
          <div className="relative border-t pt-2 mt-2">
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent cursor-pointer outline-none"
            >
              <Avatar className="size-6 shrink-0">
                {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
                <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-medium">{user.name}</span>
                <span className="truncate text-[11px] text-muted-foreground">{user.email}</span>
              </div>
            </button>
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute bottom-full left-0 mb-1 w-56 rounded-md border bg-popover p-1 shadow-md z-50">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      router.push("/parametres?tab=team");
                    }}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer text-left"
                  >
                    <Users className="size-4 text-muted-foreground" />
                    Équipe
                  </button>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      router.push("/parametres?tab=organizations");
                    }}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer text-left"
                  >
                    <Building2 className="size-4 text-muted-foreground" />
                    Organisations
                  </button>
                  <div className="my-1 h-px bg-border" />
                  <button
                    onClick={async () => {
                      setUserMenuOpen(false);
                      const supabase = createClient();
                      await supabase.auth.signOut();
                      router.push("/login");
                      router.refresh();
                    }}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer text-left text-destructive"
                  >
                    <LogOut className="size-4" />
                    Se déconnecter
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </SidebarFooter>
    </SidebarContainer>
  );
}
