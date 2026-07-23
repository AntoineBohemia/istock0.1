import type { Role } from "@/lib/stores/organization-store";

export type PageRoutesType = {
  title: string;
  items: PageRoutesItemType;
  allowedRoles?: Role[];
};

export type PageRoutesItemType = {
  title: string;
  href: string;
  icon?: string;
  isComing?: boolean;
  isDataBadge?: string;
  isNew?: boolean;
  newTab?: boolean;
  items?: PageRoutesItemType;
  allowedRoles?: Role[];
}[];

// Trois groupes par nature, plutot que deux dont le premier melangeait tout.
//
// « Inventaire » reunissait ce qu'on stocke (produits, outillage) et les
// acteurs autour (un fournisseur externe, des techniciens, des vehicules) —
// des entites qui ne sont pas des articles de stock et n'avaient rien a y
// faire. Le decoupage suit maintenant la nature des choses : les biens, ce qui
// leur arrive, et les tiers.
export const page_routes: PageRoutesType[] = [
  {
    // Ce qu'on detient et qu'on suit en quantite.
    title: "Stock",
    allowedRoles: ["owner", "admin"],
    items: [
      {
        title: "Produits",
        href: "/produits",
        icon: "Package",
      },
      {
        title: "Outillage",
        href: "/outillage",
        icon: "Wrench",
      },
    ],
  },
  {
    // Ce qui arrive au stock, dans le temps.
    title: "Activité",
    allowedRoles: ["owner", "admin"],
    items: [
      {
        title: "Mouvements",
        href: "/mouvements",
        icon: "ArrowLeftRight",
      },
      {
        title: "Achats",
        href: "/achats",
        icon: "ShoppingCart",
      },
    ],
  },
  {
    // Les tiers autour du stock : chez qui on achete, qui detient quoi.
    title: "Répertoire",
    allowedRoles: ["owner", "admin"],
    items: [
      {
        title: "Fournisseurs",
        href: "/fournisseurs",
        icon: "Truck",
      },
      {
        title: "Techniciens",
        href: "/techniciens",
        icon: "HardHat",
      },
      {
        title: "Véhicules",
        href: "/vehicules",
        icon: "Car",
      },
    ],
  },
];

export function isRoleAllowed(role: Role | undefined, allowedRoles: Role[] | undefined): boolean {
  if (!allowedRoles) return true;
  if (!role) return false;
  return allowedRoles.includes(role);
}

export function filterRoutesByRole(
  routes: PageRoutesType[],
  role: Role | undefined
): PageRoutesType[] {
  return routes
    .filter((section) => isRoleAllowed(role, section.allowedRoles))
    .map((section) => ({
      ...section,
      items: section.items
        .filter((item) => isRoleAllowed(role, item.allowedRoles))
        .map((item) => ({
          ...item,
          items: item.items?.filter((sub) => isRoleAllowed(role, sub.allowedRoles)),
        })),
    }))
    .filter((section) => section.items.length > 0);
}
