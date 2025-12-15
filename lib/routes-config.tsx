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
          { title: "Liste des produits", href: "/product" },
          { title: "Détail produit", href: "/product/1" },
          { title: "Ajouter un produit", href: "/product/create" },
        ],
      },
      {
        title: "Techniciens",
        href: "/users",
        icon: "Users",
        items: [
          { title: "Liste des techniciens", href: "/users" },
          { title: "Inventaire technicien", href: "/users/inventory" },
        ],
      },
      {
        title: "Flux de stock",
        href: "/orders",
        icon: "ArrowLeftRight",
        items: [
          { title: "Entrées & sorties", href: "/orders" },
          { title: "Détail entrée", href: "/orders/income/1" },
          { title: "Détail sortie", href: "/orders/outcome/1" },
        ],
      },
    ],
  },
  {
    title: "Paramètres",
    items: [
      {
        title: "Catégories",
        href: "/settings/categories",
        icon: "Tags",
      },
    ],
  },
];
