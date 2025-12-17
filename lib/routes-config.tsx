type PageRoutesType = {
  title: string;
  items: PageRoutesItemType;
};

type PageRoutesItemType = {
  title: string;
  href: string;
  icon?: string;
  isComing?: boolean;
  isDataBadge?: string;
  isNew?: boolean;
  newTab?: boolean;
  isDynamicTechnicians?: boolean;
  items?: PageRoutesItemType;
}[];

export const page_routes: PageRoutesType[] = [
  {
    title: "Stock",
    items: [
      {
        title: "Vue d'ensemble",
        href: "/global",
        icon: "ChartPie",
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
          { title: "Catégories", href: "/settings/categories" },
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
