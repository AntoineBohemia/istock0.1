import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes protégées (nécessitent une connexion)
const PROTECTED_ROUTES = [
  "/calendar",
  "/global",
  "/orders",
  "/product",
  "/users",
  "/settings",
];

// Routes d'authentification (accessibles uniquement si NON connecté)
const AUTH_ROUTES = ["/login", "/register", "/forgot-password"];

// Page par défaut après connexion
const DEFAULT_AUTHENTICATED_ROUTE = "/global";

// Page de connexion
const LOGIN_ROUTE = "/login";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Vérifie si c'est une route d'authentification (login, register, forgot-password)
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route);

  // Vérifie si c'est une route protégée (commence par un des préfixes)
  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Vérifie si c'est la page d'accueil (dev page)
  const isHomePage = pathname === "/";

  // ═══════════════════════════════════════════════════════════════
  // RÈGLES DE REDIRECTION
  // ═══════════════════════════════════════════════════════════════

  // 1. Utilisateur connecté sur page d'accueil → rediriger vers dashboard
  if (user && isHomePage) {
    const url = request.nextUrl.clone();
    url.pathname = DEFAULT_AUTHENTICATED_ROUTE;
    return NextResponse.redirect(url);
  }

  // 2. Utilisateur connecté sur route d'auth → rediriger vers dashboard
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = DEFAULT_AUTHENTICATED_ROUTE;
    return NextResponse.redirect(url);
  }

  // 3. Utilisateur NON connecté sur route protégée → rediriger vers login
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_ROUTE;
    // Optionnel: sauvegarder l'URL de destination pour rediriger après login
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match toutes les routes sauf:
     * - _next/static (fichiers statiques)
     * - _next/image (optimisation d'images)
     * - favicon.ico
     * - fichiers images (svg, png, jpg, etc.)
     * - api routes
     */
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
