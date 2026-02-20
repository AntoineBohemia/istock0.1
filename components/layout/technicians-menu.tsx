"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Loader2 } from "lucide-react";

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
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import Icon from "@/components/icon";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationStore } from "@/lib/stores/organization-store";

interface Technician {
  id: string;
  first_name: string;
  last_name: string;
}

interface TechniciansMenuProps {
  title: string;
  href: string;
  icon?: string;
}

export default function TechniciansMenu({ title, href, icon }: TechniciansMenuProps) {
  const pathname = usePathname();
  const { isMobile } = useSidebar();
  const { currentOrganization } = useOrganizationStore();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadTechnicians() {
      if (!currentOrganization) {
        setTechnicians([]);
        setIsLoading(false);
        return;
      }

      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("technicians")
          .select("id, first_name, last_name")
          .eq("organization_id", currentOrganization.id)
          .order("last_name");

        if (error) throw error;
        setTechnicians(data || []);
      } catch (error) {
        console.error("Error loading technicians:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadTechnicians();
  }, [currentOrganization]);

  return (
    <Fragment>
      {/* Version collapsed (icon mode) */}
      <div className="hidden group-data-[collapsible=icon]:block">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className="hover:text-foreground! active:text-foreground! hover:bg-[var(--primary)]/10! active:bg-[var(--primary)]/10!"
              tooltip={title}
            >
              {icon && (
                <Icon
                  name={icon}
                  className="accent-sidebar-foreground size-4"
                />
              )}
              <span>{title}</span>
              <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? "bottom" : "right"}
            align={isMobile ? "end" : "start"}
            className="min-w-48 rounded-lg"
          >
            <DropdownMenuLabel>{title}</DropdownMenuLabel>
            <DropdownMenuItem
              className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10! active:bg-[var(--primary)]/10! font-medium"
              asChild
            >
              <a href={href}>Liste des techniciens</a>
            </DropdownMenuItem>
            <ScrollArea className="max-h-64">
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                technicians.map((tech) => (
                  <DropdownMenuItem
                    className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10! active:bg-[var(--primary)]/10! pl-6 text-muted-foreground"
                    asChild
                    key={tech.id}
                  >
                    <a href={`/users/${tech.id}`}>
                      {tech.first_name} {tech.last_name}
                    </a>
                  </DropdownMenuItem>
                ))
              )}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Version expanded */}
      <Collapsible className="group/collapsible block group-data-[collapsible=icon]:hidden">
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            className="hover:text-foreground! active:text-foreground! hover:bg-[var(--primary)]/10! active:bg-[var(--primary)]/10!"
            tooltip={title}
            isActive={pathname === href || pathname.startsWith(`${href}/`)}
          >
            {icon && (
              <Icon
                name={icon}
                className="accent-sidebar-foreground size-4"
              />
            )}
            <span>{title}</span>
            <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ScrollArea className="max-h-48">
            <SidebarMenuSub>
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                technicians.map((tech) => (
                  <SidebarMenuSubItem key={tech.id}>
                    <SidebarMenuSubButton
                      className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10 active:bg-[var(--primary)]/10 text-muted-foreground"
                      isActive={pathname === `/users/${tech.id}`}
                      asChild
                    >
                      <Link href={`/users/${tech.id}`}>
                        <span>{tech.first_name} {tech.last_name}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))
              )}
            </SidebarMenuSub>
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>
    </Fragment>
  );
}
