"use client";

import { usePathname } from "next/navigation";

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
  const title = getTitle(pathname);

  // Le logo de l'organisation a ete retire : sur mobile on ne change pas de
  // societe, l'afficher n'informait de rien et concurrencait le titre.
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4 md:hidden">
      <img src="/logo/istock-app.svg" alt="iStock" className="size-7" />
      <h1 className="text-base font-semibold truncate">{title}</h1>
    </header>
  );
}
