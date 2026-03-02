"use client";

import Link from "next/link";
import {
  ChartPie,
  ShoppingBag,
  ArrowLeftRight,
  Users,
  Building2,
  Settings,
  Tags,
  ChevronRight,
  Check,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useOrganizationStore } from "@/lib/stores/organization-store";

const links = [
  { title: "Produits", href: "/product", icon: ShoppingBag },
  { title: "Flux de stock", href: "/orders", icon: ArrowLeftRight },
  { title: "Catégories", href: "/settings/categories", icon: Tags },
  { title: "Équipe", href: "/settings/members", icon: Users },
  { title: "Organisations", href: "/settings/organizations", icon: Building2 },
  { title: "Paramètres", href: "/settings", icon: Settings },
];

export default function MorePage() {
  const { currentOrganization, organizations, switchOrganization } =
    useOrganizationStore();

  return (
    <div className="space-y-6">
      {/* Navigation links */}
      <div className="rounded-lg border divide-y">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <Icon className="size-5 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium">{link.title}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          );
        })}
      </div>

      {/* Organization switcher */}
      {currentOrganization && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground px-1">
            Organisation
          </p>
          <div className="rounded-lg border divide-y">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => switchOrganization(org.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <Avatar className="size-7">
                  {org.logo_url && (
                    <AvatarImage src={org.logo_url} alt={org.name} />
                  )}
                  <AvatarFallback className="text-[10px]">
                    {org.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate text-sm font-medium">
                  {org.name}
                </span>
                {org.id === currentOrganization.id && (
                  <Check className="size-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
