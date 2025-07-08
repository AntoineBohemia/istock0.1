"use client";

import { Fragment, useEffect } from "react";
import Link from "next/link";
import { page_routes } from "@/lib/routes-config";
import { ChevronRight, ChevronsUpDown } from "lucide-react";
import { usePathname } from "next/navigation";

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
import Logo from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { useIsTablet } from "@/hooks/use-mobile";

export default function Sidebar() {
  const pathname = usePathname();
  const { setOpen, setOpenMobile, isMobile } = useSidebar();
  const isTablet = useIsTablet();

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
                  <Logo />
                  <div className="truncate font-semibold group-data-[collapsible=icon]:hidden">
                    SMPR
                  </div>
                  <ChevronsUpDown className="ml-auto group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-(--radix-popper-anchor-width)">
                <DropdownMenuItem>
                  <span>Ecommerce</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <span>Web Analiytics</span>
                </DropdownMenuItem>
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
                      {item.items?.length ? (
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
                            <CollapsibleTrigger asChild>
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
                            </CollapsibleTrigger>
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
