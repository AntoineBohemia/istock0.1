"use client";

import ThemeSwitch from "@/components/layout/header/theme-switch";

/**
 * Bandeau superieur, sur ordinateur.
 *
 * Le bouton de repli du menu a ete retire : le menu tient sur toutes les
 * tailles d'ecran visees et n'a pas besoin d'etre reduit. Il occupait le coin
 * superieur gauche de chaque page, la ou le regard se pose en premier, pour
 * une action que personne n'utilise.
 *
 * Le menu reste repliable au clavier — le raccourci du composant Sidebar est
 * conserve — mais il ne coute plus rien a l'ecran.
 */
export default function Header() {
  return (
    <div className="sticky top-0 z-50 hidden flex-col md:flex">
      <header className="bg-background/50 flex h-14 items-center justify-end gap-3 px-4 backdrop-blur-xl lg:h-[60px]">
        <ThemeSwitch />
      </header>
    </div>
  );
}
