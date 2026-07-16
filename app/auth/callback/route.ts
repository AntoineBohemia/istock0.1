import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/actions";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/actions";

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // If returning from invite flow, auto-accept server-side
      const inviteMatch = next.match(/^\/invite\/(.+)$/);
      if (inviteMatch) {
        const token = inviteMatch[1];
        try {
          await supabase.rpc("accept_invitation_secure", { p_token: token });
          // Redirect straight to app — invitation accepted
          return NextResponse.redirect(`${origin}/actions?invited=true`);
        } catch {
          // If auto-accept fails, fall through to the invite page
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
