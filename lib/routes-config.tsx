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
  isDynamicTechnicians?: boolean;
  items?: PageRoutesItemType;
  allowedRoles?: Role[];
}[];

export const page_routes: PageRoutesType[] = [
  {
    title: "Stock",
    items: [
      {
        title: "Vue d'ensemble",
        href: "/global",
        icon: "ChartPie",
        allowedRoles: ["owner", "admin", "member"],
      },
      /* {
        title: "Calendrier",
        href: "/calendar",
        icon: "Calendar",
      },*/
      {
        title: "Stock produits",
        href: "/product",
        icon: "ShoppingBag",
        items: [
          { title: "Produits", href: "/product" },
          {
            title: "Catégories",
            href: "/settings/categories",
            allowedRoles: ["owner", "admin", "member"],
          },
        ],
      },
      {
        title: "Techniciens",
        href: "/users",
        icon: "Users",
        isDynamicTechnicians: true,
      },
      {
        title: "Flux de stock",
        href: "/orders",
        icon: "ArrowLeftRight",
      },
    ],
  },
  {
    title: "Configuration",
    allowedRoles: ["owner", "admin", "member"],
    items: [
      {
        title: "Équipe",
        href: "/settings/members",
        icon: "Users",
      },
      {
        title: "Organisations",
        href: "/settings/organizations",
        icon: "Building2",
      },
      {
        title: "Paramètres",
        href: "/settings",
        icon: "Settings",
        isComing: true,
      },
    ],
  },
];

export function isRoleAllowed(
  role: Role | undefined,
  allowedRoles: Role[] | undefined
): boolean {
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
          items: item.items?.filter((sub) =>
            isRoleAllowed(role, sub.allowedRoles)
          ),
        })),
    }))
    .filter((section) => section.items.length > 0);
}
