"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { page_routes, filterRoutesByRole, isRoleAllowed, SETTINGS_ALLOWED_ROLES } from "@/lib/routes-config";
import { ChevronsUpDown, Loader2, Check, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useSwitchOrganization } from "@/components/organization-provider";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { OrganizationAvatar } from "@/components/ui/organization-avatar";
import { useIsTablet } from "@/hooks/use-mobile";
import { createClient } from "@/lib/supabase/client";

export default function Sidebar() {
  const pathname = usePathname();
  const { setOpen, setOpenMobile, isMobile } = useSidebar();
  const isTablet = useIsTablet();

  const { currentOrganization, organizations, isLoading } = useOrganizationStore();
  const switchOrganization = useSwitchOrganization();

  // User data for footer
  const [user, setUser] = useState<{ name: string; email: string; avatar: string | null } | null>(null);

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname]);

  useEffect(() => {
    setOpen(!isTablet);
  }, [isTablet]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
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
    });
  }, []);

  const showSettings = isRoleAllowed(currentOrganization?.role, SETTINGS_ALLOWED_ROLES);
  const initials = user
    ? (user.name || user.email || "U").slice(0, 2).toUpperCase()
    : "U";

  return (
    <SidebarContainer
      collapsible="icon"
      variant="floating"
      className="bg-background"
    >
      {/* ── Org switcher ── */}
      <SidebarHeader className="items-center justify-center pt-3 transition-all group-data-[collapsible=icon]:pt-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="hover:text-foreground rounded-none group-data-[collapsible=icon]:px-0! hover:bg-[var(--primary)]/10">
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <OrganizationAvatar
                      name={currentOrganization?.name || "Organisation"}
                      logoUrl={currentOrganization?.logo_url}
                      size="xs"
                    />
                  )}
                  <div className="truncate font-semibold group-data-[collapsible=icon]:hidden">
                    {isLoading ? "..." : currentOrganization?.name || "Organisation"}
                  </div>
                  <ChevronsUpDown className="ml-auto group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-(--anchor-width)">
                <DropdownMenuLabel>Organisations</DropdownMenuLabel>
                {organizations.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => {
                      if (org.id !== currentOrganization?.id) {
                        switchOrganization(org.id);
                      }
                    }}
                    className="flex items-center gap-2"
                  >
                    <OrganizationAvatar
                      name={org.name}
                      logoUrl={org.logo_url}
                      size="xs"
                    />
                    <span className="flex-1 truncate">{org.name}</span>
                    {org.id === currentOrganization?.id && (
                      <Check className="size-4 text-primary shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}
                {organizations.length === 0 && !isLoading && (
                  <DropdownMenuItem disabled>
                    <span className="text-muted-foreground">Aucune organisation</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
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
              <SidebarMenu className="space-y-1">
                {route.items.map((item, idx) => (
                  <SidebarMenuItem key={idx}>
                    <SidebarMenuButton
                      className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10 active:bg-[var(--primary)]/10"
                      asChild
                      tooltip={item.title}
                      isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                    >
                      <Link href={item.href}>
                        {item.icon && (
                          <Icon
                            name={item.icon}
                            className="accent-sidebar-foreground size-4"
                          />
                        )}
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* ── Footer : Paramètres + Utilisateur ── */}
      <SidebarFooter className="gap-0">
        {showSettings && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10 active:bg-[var(--primary)]/10"
                asChild
                tooltip="Paramètres"
                isActive={pathname === "/settings" || pathname.startsWith("/settings/")}
              >
                <Link href="/settings">
                  <Settings className="size-4" />
                  <span>Paramètres</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
        {user && (
          <div className="border-t pt-2 mt-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip={user.name || "Utilisateur"} className="cursor-default">
                  <Avatar className="size-6 shrink-0">
                    {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
                    <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid text-left leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-sm font-medium">{user.name}</span>
                    <span className="truncate text-[11px] text-muted-foreground">{user.email}</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        )}
      </SidebarFooter>
    </SidebarContainer>
  );
}
