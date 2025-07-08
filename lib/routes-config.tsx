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
        href: "/dashboard/default",
        icon: "ChartPie",
      },
      {
        title: "Catalogue",
        href: "#",
        icon: "ShoppingBag",
        items: [
          { title: "Aperçu du catalogue", href: "/dashboard/ecommerce" },
          { title: "Catalogue produits", href: "/dashboard/pages/products" },
          { title: "Détail produit", href: "/dashboard/pages/products/1" },
          {
            title: "Ajouter produit",
            href: "/dashboard/pages/products/create",
          },
          { title: "Liste des commandes", href: "/dashboard/pages/orders" },
          { title: "Détail commande", href: "/dashboard/pages/orders/detail" },
        ],
      },
      {
        title: "Fournisseurs",
        href: "/dashboard/crm",
        icon: "ChartBarDecreasing",
      },
      {
        title: "Analytique stock",
        href: "/dashboard/website-analytics",
        icon: "Gauge",
      },
      {
        title: "Approvisionnement",
        href: "/dashboard/project-management",
        icon: "FolderDot",
      },
    ],
  },
  {
    title: "Opérations",
    items: [
      {
        title: "Calendrier",
        href: "/dashboard/apps/calendar",
        icon: "Calendar",
      },
      {
        title: "Assistant IA",
        href: "/dashboard/apps/ai-chat",
        icon: "Brain",
        isNew: true,
      },
    ],
  },
  /*{
    title: "Gestion",
    items: [
      {
        title: "Équipe",
        href: "/dashboard/pages/users",
        icon: "Users",
        items: [
          { title: "Liste équipe", href: "/dashboard/pages/users" },
          { title: "Profil membre", href: "/dashboard/pages/profile" },
        ],
      },
      {
        title: "Paramètres",
        href: "/dashboard/pages/settings",
        icon: "Settings",
        items: [
          { title: "Profil", href: "/dashboard/pages/settings" },
          {
            title: "Compte",
            href: "/dashboard/pages/settings/account",
          },
          {
            title: "Apparence",
            href: "/dashboard/pages/settings/appearance",
          },
          {
            title: "Notifications",
            href: "/dashboard/pages/settings/notifications",
          },
          {
            title: "Affichage",
            href: "/dashboard/pages/settings/display",
          },
        ],
      },
      {
        title: "Abonnement",
        href: "#",
        icon: "BadgeDollarSign",
        items: [
          { title: "Plan colonne", href: "/dashboard/pages/pricing/column" },
          { title: "Plan tableau", href: "/dashboard/pages/pricing/table" },
          { title: "Plan unique", href: "/dashboard/pages/pricing/single" },
        ],
      },
      {
        title: "Accès",
        href: "/",
        icon: "Fingerprint",
        items: [
          { title: "Connexion v1", href: "/dashboard/login/v1" },
          { title: "Connexion v2", href: "/dashboard/login/v2" },
          { title: "Inscription v1", href: "/dashboard/register/v1" },
          { title: "Inscription v2", href: "/dashboard/register/v2" },
          { title: "Réinitialiser mot de passe", href: "/dashboard/forgot-password" },
        ],
      },
      {
        title: "Erreurs",
        href: "/",
        icon: "Fingerprint",
        items: [
          { title: "404", href: "/dashboard/pages/error/404" },
          { title: "500", href: "/dashboard/pages/error/500" },
          { title: "403", href: "/dashboard/pages/error/403" },
        ],
      },
      {
        title: "Site public",
        href: "/template/cosmic-landing-page-template",
        icon: "Proportions",
        newTab: true,
      },
    ],
  },
  {
    title: "Utilitaires",
    items: [
      {
        title: "Composants UI",
        href: "/components",
        icon: "Component",
        newTab: true,
      },
      {
        title: "Blocs de mise en page",
        href: "/blocks",
        icon: "Component",
        newTab: true,
      },
      {
        title: "Modèles",
        href: "/templates",
        icon: "Proportions",
        newTab: true,
      },
      {
        title: "Documentation",
        href: "#",
        icon: "ClipboardMinus",
        isComing: true,
      },
    ],
  },*/
];
