import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes protégées (nécessitent une connexion)
const PROTECTED_ROUTES = [
  "/achats",
  "/calendar",
  "/actions",
  "/factures",
  "/fournisseurs",
  "/onboarding-flow",
  "/mouvements",
  "/outillage",
  "/produits",
  "/techniciens",
  "/vehicules",
  "/parametres",
];

// Routes d'authentification (accessibles uniquement si NON connecté)
const AUTH_ROUTES = ["/login", "/register", "/forgot-password"];

// Page par défaut après connexion
const DEFAULT_AUTHENTICATED_ROUTE = "/actions";

// Page de connexion
const LOGIN_ROUTE = "/login";

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Handle Supabase email confirmation code redirect
  // If we're at the root and there's a code parameter, redirect to /auth/callback
  // This handles the case where Supabase email confirmation redirects to /?code=...
  // instead of /auth/callback?code=...
  if (pathname === "/" && searchParams.has("code")) {
    const code = searchParams.get("code");
    const next = searchParams.get("next");

    const callbackUrl = new URL("/auth/callback", request.url);
    callbackUrl.searchParams.set("code", code!);
    if (next) {
      callbackUrl.searchParams.set("next", next);
    }

    return NextResponse.redirect(callbackUrl);
  }

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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
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
    error,
  } = await supabase.auth.getUser();

  // Si le refresh token est invalide/expiré, nettoyer la session et rediriger vers login
  if (error?.code === "refresh_token_not_found") {
    const response = NextResponse.redirect(new URL(LOGIN_ROUTE, request.url));
    // Supprimer les cookies de session Supabase
    response.cookies.delete("sb-amlqevfympqjrnqcnizq-auth-token");
    response.cookies.delete("sb-amlqevfympqjrnqcnizq-auth-token-code-verifier");
    return response;
  }

  // pathname already extracted at the beginning

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

  // 3. Utilisateur NON connecté sur route protégée
  if (!user && isProtectedRoute) {
    // [DEV ONLY] Auto-login si DEV_USER_EMAIL + DEV_USER_PASSWORD sont définis
    if (
      process.env.NODE_ENV === "development" &&
      process.env.DEV_USER_EMAIL &&
      process.env.DEV_USER_PASSWORD
    ) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: process.env.DEV_USER_EMAIL,
        password: process.env.DEV_USER_PASSWORD,
      });

      if (!signInError) {
        // Session cookies posés sur supabaseResponse — on redirige vers la même URL
        const url = request.nextUrl.clone();
        const redirect = NextResponse.redirect(url);
        // Copier les Set-Cookie de supabaseResponse vers la réponse redirect
        supabaseResponse.headers.forEach((value, key) => {
          if (key === "set-cookie") {
            redirect.headers.append("set-cookie", value);
          }
        });
        return redirect;
      }
    }

    // Redirection normale vers login
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_ROUTE;
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
