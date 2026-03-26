"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import { useSwitchOrganization } from "@/components/organization-provider";

export default function OrgSwitcher() {
  const { currentOrganization, organizations } = useOrganizationStore();
  const handleSwitch = useSwitchOrganization();

  if (!currentOrganization || organizations.length <= 1) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 max-w-[200px]">
          <Avatar className="size-5">
            {currentOrganization.logo_url && (
              <AvatarImage
                src={currentOrganization.logo_url}
                alt={currentOrganization.name}
              />
            )}
            <AvatarFallback className="text-[8px]">
              {currentOrganization.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-xs font-medium">
            {currentOrganization.name}
          </span>
          <ChevronsUpDown className="size-3 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px]">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Organisations
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleSwitch(org.id)}
            className="gap-2"
          >
            <Avatar className="size-5">
              {org.logo_url && (
                <AvatarImage src={org.logo_url} alt={org.name} />
              )}
              <AvatarFallback className="text-[8px]">
                {org.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="flex-1 truncate text-sm">{org.name}</span>
            {org.id === currentOrganization.id && (
              <Check className="size-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
