import Link from "next/link";
import {
  Calendar,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  LogIn,
  UserPlus,
  KeyRound,
  AlertCircle,
  ServerCrash,
  ExternalLink,
  Settings,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const publicRoutes = [
  {
    title: "Connexion",
    href: "/login",
    icon: LogIn,
    description: "Page de connexion utilisateur",
  },
  {
    title: "Inscription",
    href: "/register",
    icon: UserPlus,
    description: "Créer un nouveau compte",
  },
  {
    title: "Mot de passe oublié",
    href: "/forgot-password",
    icon: KeyRound,
    description: "Réinitialiser le mot de passe",
  },
];

const protectedRoutes = [
  {
    title: "Tableau de bord",
    href: "/global",
    icon: LayoutDashboard,
    description: "Vue d'ensemble et statistiques globales",
  },
  /*{
    title: "Calendrier",
    href: "/calendar",
    icon: Calendar,
    description: "Gestion du calendrier et événements",
  },*/
  {
    title: "Produits",
    href: "/product",
    icon: Package,
    description: "Liste des produits",
    children: [
      { title: "Créer un produit", href: "/product/create" },
      { title: "Détail produit", href: "/product/1" },
    ],
  },
  {
    title: "Commandes",
    href: "/orders",
    icon: ShoppingCart,
    description: "Gestion des commandes",
    children: [
      { title: "Détail commande", href: "/orders/1" },
      { title: "Entrée stock", href: "/orders/income/1" },
      { title: "Sortie stock", href: "/orders/outcome/1" },
    ],
  },
  {
    title: "Utilisateurs",
    href: "/users",
    icon: Users,
    description: "Gestion des utilisateurs",
    children: [{ title: "Inventaire", href: "/users/inventory" }],
  },
  {
    title: "Paramètres",
    href: "/settings/categories",
    icon: Settings,
    description: "Configuration de l'application",
    children: [{ title: "Catégories", href: "/settings/categories" }],
  },
];

const errorRoutes = [
  {
    title: "Erreur 404",
    href: "/error/404",
    icon: AlertCircle,
    description: "Page non trouvée",
  },
  {
    title: "Erreur 500",
    href: "/error/500",
    icon: ServerCrash,
    description: "Erreur serveur",
  },
];

export default function DevPage() {
  return (
    <div className="relative min-h-screen bg-background p-8">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2 pb-8 border-b">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-sm font-medium mb-4">
            Mode Développeur
          </div>
          <h1 className="text-4xl font-bold">iStock - Architecture</h1>
          <p className="text-muted-foreground">
            Navigation rapide vers toutes les pages de l&apos;application
          </p>
        </div>

        {/* Public Routes */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <h2 className="text-xl font-semibold">Pages Publiques</h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              Authentification
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {publicRoutes.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-md bg-blue-500/10 text-blue-500">
                    <route.icon className="h-4 w-4" />
                  </div>
                  <span className="font-medium group-hover:underline">
                    {route.title}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {route.description}
                </p>
                <code className="text-xs bg-muted px-2 py-0.5 rounded">
                  {route.href}
                </code>
              </Link>
            ))}
          </div>
        </section>

        {/* Protected Routes */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <h2 className="text-xl font-semibold">Pages Protégées</h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              Connexion requise
            </span>
          </div>
          <div className="grid gap-3">
            {protectedRoutes.map((route) => (
              <div
                key={route.href}
                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-md bg-primary/10 text-primary">
                    <route.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <Link
                        href={route.href}
                        className="font-medium hover:underline flex items-center gap-1"
                      >
                        {route.title}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {route.href}
                      </code>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {route.description}
                    </p>
                    {route.children && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {route.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className="inline-flex items-center gap-1 text-xs bg-secondary hover:bg-secondary/80 px-2 py-1 rounded transition-colors"
                          >
                            {child.title}
                            <code className="text-muted-foreground">
                              {child.href}
                            </code>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Error Routes */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <h2 className="text-xl font-semibold">Pages d&apos;Erreur</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {errorRoutes.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-md bg-red-500/10 text-red-500">
                    <route.icon className="h-4 w-4" />
                  </div>
                  <span className="font-medium group-hover:underline">
                    {route.title}
                  </span>
                </div>
                <code className="text-xs bg-muted px-2 py-0.5 rounded">
                  {route.href}
                </code>
              </Link>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-sm text-muted-foreground pt-8 border-t">
          <p>Cette page est visible uniquement en mode développement.</p>
          <p className="mt-1">
            Les pages protégées redirigent vers{" "}
            <code className="bg-muted px-1 rounded">/login</code> si non
            connecté.
          </p>
        </footer>
      </div>
    </div>
  );
}
