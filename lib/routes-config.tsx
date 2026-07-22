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

export const page_routes: PageRoutesType[] = [
  {
    title: "Inventaire",
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
    ],
  },
  {
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
