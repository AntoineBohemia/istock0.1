"use client";

import { Fragment, useEffect } from "react";
import Link from "next/link";
import { page_routes } from "@/lib/routes-config";
import { ChevronRight, ChevronsUpDown, Loader2, Check } from "lucide-react";
import { usePathname } from "next/navigation";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useSwitchOrganization } from "@/components/organization-provider";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sidebar as SidebarContainer,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Icon from "../icon";
import { OrganizationAvatar } from "@/components/ui/organization-avatar";
import { Button } from "@/components/ui/button";
import { useIsTablet } from "@/hooks/use-mobile";
import TechniciansMenu from "@/components/layout/technicians-menu";

export default function Sidebar() {
  const pathname = usePathname();
  const { setOpen, setOpenMobile, isMobile } = useSidebar();
  const isTablet = useIsTablet();

  // Organisation
  const { currentOrganization, organizations, isLoading } = useOrganizationStore();
  const switchOrganization = useSwitchOrganization();

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname]);

  useEffect(() => {
    setOpen(!isTablet);
  }, [isTablet]);

  return (
    <SidebarContainer
      collapsible="icon"
      variant="floating"
      className="bg-background"
    >
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
              <DropdownMenuContent className="w-(--radix-popper-anchor-width)">
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
      <SidebarContent className="overflow-hidden">
        <ScrollArea className="h-full">
          {page_routes.map((route, key) => (
            <SidebarGroup key={key}>
              <SidebarGroupLabel className="text-xs tracking-wider uppercase">
                {route.title}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {route.items.map((item, key) => (
                    <SidebarMenuItem key={key}>
                      {item.isDynamicTechnicians ? (
                        <TechniciansMenu
                          title={item.title}
                          href={item.href}
                          icon={item.icon}
                        />
                      ) : item.items?.length ? (
                        <Fragment>
                          <div className="hidden group-data-[collapsible=icon]:block">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <SidebarMenuButton
                                  className="hover:text-foreground! active:text-foreground! hover:bg-[var(--primary)]/10! active:bg-[var(--primary)]/10!"
                                  tooltip={item.title}
                                >
                                  {item.icon && (
                                    <Icon
                                      name={item.icon}
                                      className="accent-sidebar-foreground size-4"
                                    />
                                  )}
                                  <span>{item.title}</span>
                                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                </SidebarMenuButton>
                              </DropdownMenuTrigger>
                              {item.items?.length ? (
                                <DropdownMenuContent
                                  side={isMobile ? "bottom" : "right"}
                                  align={isMobile ? "end" : "start"}
                                  className="min-w-48 rounded-lg"
                                >
                                  <DropdownMenuLabel>
                                    {item.title}
                                  </DropdownMenuLabel>
                                  {item.items.map((item) => (
                                    <DropdownMenuItem
                                      className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10! active:bg-[var(--primary)]/10!"
                                      asChild
                                      key={item.title}
                                    >
                                      <a href={item.href}>{item.title}</a>
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              ) : null}
                            </DropdownMenu>
                          </div>
                          <Collapsible className="group/collapsible block group-data-[collapsible=icon]:hidden">
                            <SidebarMenuButton
                              className="hover:text-foreground! active:text-foreground! hover:bg-[var(--primary)]/10! active:bg-[var(--primary)]/10!"
                              tooltip={item.title}
                              isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                              asChild
                            >
                              <Link href={item.href}>
                                {item.icon && (
                                  <Icon
                                    name={item.icon}
                                    className="accent-sidebar-foreground size-4"
                                  />
                                )}
                                <span>{item.title}</span>
                                <CollapsibleTrigger asChild>
                                  <span
                                    role="button"
                                    className="ml-auto p-1 -mr-1 rounded-sm hover:bg-accent"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                  >
                                    <ChevronRight className="size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                  </span>
                                </CollapsibleTrigger>
                              </Link>
                            </SidebarMenuButton>
                            <CollapsibleContent>
                              <SidebarMenuSub>
                                {item.items.map((subItem, key) => (
                                  <SidebarMenuSubItem key={key}>
                                    <SidebarMenuSubButton
                                      className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10 active:bg-[var(--primary)]/10"
                                      isActive={pathname === subItem.href}
                                      asChild
                                    >
                                      <Link
                                        href={subItem.href}
                                        target={subItem.newTab ? "_blank" : ""}
                                      >
                                        {subItem.icon && (
                                          <Icon
                                            name={subItem.icon}
                                            className="accent-sidebar-foreground size-4"
                                          />
                                        )}
                                        <span>{subItem.title}</span>
                                      </Link>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                ))}
                              </SidebarMenuSub>
                            </CollapsibleContent>
                          </Collapsible>
                        </Fragment>
                      ) : (
                        <SidebarMenuButton
                          className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10 active:bg-[var(--primary)]/10"
                          asChild
                          tooltip={item.title}
                          isActive={pathname === item.href}
                        >
                          <Link
                            href={item.href}
                            target={item.newTab ? "_blank" : ""}
                          >
                            {item.icon && (
                              <Icon
                                name={item.icon}
                                className="accent-sidebar-foreground size-4"
                              />
                            )}
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      )}
                      {!!item.isComing && (
                        <SidebarMenuBadge className="peer-hover/menu-button:text-foreground opacity-50">
                          Coming
                        </SidebarMenuBadge>
                      )}
                      {!!item.isNew && (
                        <SidebarMenuBadge className="border border-green-400 text-green-600 peer-hover/menu-button:text-green-600">
                          New
                        </SidebarMenuBadge>
                      )}
                      {!!item.isDataBadge && (
                        <SidebarMenuBadge className="peer-hover/menu-button:text-foreground">
                          {item.isDataBadge}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter>
        {/* <Card className="bg-muted gap-4 overflow-hidden py-4 group-data-[collapsible=icon]:hidden">
          <CardHeader className="px-3">
            <CardTitle>Upgrade to Pro</CardTitle>
            <CardDescription>
              Get pro now to own all dashboards, templates and components for
              life.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3">
            <Button className="w-full" asChild>
              <Link href="https://shadcnuikit.com/pricing" target="_blank">
                Get Shadcn UI Kit
              </Link>
            </Button>
          </CardContent>
        </Card>*/}
      </SidebarFooter>
    </SidebarContainer>
  );
}
