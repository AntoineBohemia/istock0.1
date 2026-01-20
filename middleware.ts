import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

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

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
