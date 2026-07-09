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
    title: "",
    items: [
      {
        title: "Vue d'ensemble",
        href: "/global",
        icon: "LayoutDashboard",
        allowedRoles: ["owner", "admin", "member"],
      },
      {
        title: "Produits",
        href: "/product",
        icon: "Package",
      },
      {
        title: "Techniciens",
        href: "/users",
        icon: "HardHat",
      },
      {
        title: "Mouvements",
        href: "/orders",
        icon: "ArrowLeftRight",
      },
    ],
  },
];

export const SETTINGS_ALLOWED_ROLES: Role[] = ["owner", "admin", "member"];

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
