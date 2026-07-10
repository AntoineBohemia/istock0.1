"use client";

import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useOrganizationStore } from "@/lib/stores/organization-store";

const TITLES: Record<string, string> = {
  "/actions": "Actions rapides",
  "/techniciens": "Techniciens",
  "/more": "Plus",
  "/produits": "Produits",
  "/mouvements": "Flux de stock",
  "/parametres": "Paramètres",
};

function getTitle(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  for (const [path, title] of Object.entries(TITLES)) {
    if (pathname.startsWith(path)) return title;
  }
  return "iStock";
}

export default function MobileTopBar() {
  const pathname = usePathname();
  const { currentOrganization } = useOrganizationStore();
  const title = getTitle(pathname);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b bg-background px-4 md:hidden">
      <div className="flex items-center gap-2">
        <img src="/logo/istock-app.svg" alt="iStock" className="size-7" />
        <h1 className="text-base font-semibold truncate">{title}</h1>
      </div>
      {currentOrganization && (
        <Avatar className="size-7">
          {currentOrganization.logo_url && (
            <AvatarImage src={currentOrganization.logo_url} alt={currentOrganization.name} />
          )}
          <AvatarFallback className="text-[10px]">
            {currentOrganization.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
    </header>
  );
}
