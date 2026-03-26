# INSTRUCTIONS D'IMPLEMENTATION : Multi-comptes & Invitations

> Document de référence pour l'implémentation par tâches atomiques.
> Chaque tâche = une session de travail autonome.
> Ne jamais lancer plusieurs tâches en même temps.

---

## ARCHITECTURE ACTUELLE (CONTEXTE)

### Tables existantes
```
organizations (id, name, slug, logo_url, created_at)
user_organizations (id, user_id, organization_id, role, is_default, created_at)
  - UNIQUE(user_id, organization_id)
  - role: text, default 'member'
organization_invitations (id, organization_id, email, role, token, invited_by, expires_at, accepted_at, created_at)
  - UNIQUE(organization_id, email)
  - UNIQUE(token)
  - expires_at default: now() + 7 days
  - token default: encode(gen_random_bytes(32), 'hex')
```

### Helper functions SQL existantes
```sql
get_user_organization_ids()        -- retourne les org_ids du user auth.uid()
is_organization_owner(org_id)      -- true si auth.uid() est owner de l'org
is_org_admin_or_owner(user_id, org_id) -- true si user est admin ou owner
```

### RLS existantes sur organization_invitations (A CORRIGER)
```
SELECT: qual = "true"  ← FAILLE : tout le monde peut lire toutes les invitations
INSERT: owner/admin de l'org
UPDATE: owner/admin de l'org
DELETE: owner/admin de l'org
```

### Fichiers clés
```
lib/supabase/queries/organizations.ts    -- toutes les queries org/invite
lib/stores/organization-store.ts         -- Zustand store (currentOrganization, organizations)
hooks/mutations/use-organization-mutations.ts -- mutations React Query
components/organization-provider.tsx     -- auth guard + org loading + redirect onboarding
app/invite/[token]/page.tsx              -- page acceptation invitation
app/(protected)/settings/members/page.tsx    -- gestion membres
app/(protected)/settings/organizations/page.tsx -- gestion orgs
app/(protected)/more/page.tsx            -- org switcher mobile
app/(public)/login/page.tsx              -- login (lit ?redirectTo, default /global)
app/(public)/register/page.tsx           -- register (NE lit PAS ?email ni ?returnUrl)
app/auth/callback/route.ts              -- échange code → session, lit ?next (default /global)
```

### Dépendances installées (pertinentes)
```
@supabase/supabase-js: ^2.87.1
next: 16.0.10
react: ^19.0.0
zustand: ^5.0.7
@tanstack/react-query: ^5.90.21
sonner: ^2.0.6
zod: ^3.25.74
react-hook-form: ^7.59.0
```

### Ce qui N'EXISTE PAS
- Pas de `middleware.ts`
- Pas d'Edge Functions déployées
- Pas de service email configuré
- Pas de table `user_profiles`
- Pas de page "mes invitations reçues"
- Pas de fonctionnalité "quitter une org"
- Pas de transfert de propriété owner

---

## PHASE 0 : SECURITE (Priorité absolue)

### TACHE 0.1 : Corriger la RLS SELECT sur `organization_invitations`

**Problème exact :**
La policy SELECT actuelle est `qual = "true"` avec `roles = "{public}"`. N'importe quel utilisateur (même non authentifié via la clé anon) peut lire TOUTES les invitations, y compris les tokens. Un attaquant peut lister les tokens et accepter des invitations destinées à d'autres.

**Fichier à créer :**
`supabase/migrations/YYYYMMDDHHMMSS_fix_invitation_select_rls.sql`

**SQL exact :**
```sql
-- Supprimer l'ancienne policy SELECT permissive
DROP POLICY IF EXISTS "View invitations" ON public.organization_invitations;

-- Policy 1 : Les admins/owners voient les invitations de leur org
CREATE POLICY "Admins can view org invitations"
  ON public.organization_invitations
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT uo.organization_id
      FROM user_organizations uo
      WHERE uo.user_id = auth.uid()
        AND uo.role IN ('owner', 'admin')
    )
  );

-- Policy 2 : Un utilisateur peut voir les invitations qui lui sont destinées (par email)
CREATE POLICY "Users can view own invitations"
  ON public.organization_invitations
  FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
  );
```

**Validation :**
1. Connecte-toi avec un user membre (pas admin) d'une org
2. Fais un `SELECT * FROM organization_invitations` → ne doit retourner que les invitations dont l'email correspond au tien
3. Connecte-toi avec un admin → doit voir les invitations de son org
4. Vérifie que la page `/invite/[token]` fonctionne toujours (elle utilise `getInvitationByToken` qui filtre par token — le user doit être authentifié avec le bon email)

**Piège connu :**
La page d'invitation `/invite/[token]` fait un `getInvitationByToken(token)` SANS être authentifié parfois (l'utilisateur peut ne pas être connecté quand il clique le lien). Avec la nouvelle policy, un user non-connecté ne verra plus l'invitation.

**Solution au piège :**
La query `getInvitationByToken` dans `lib/supabase/queries/organizations.ts` (ligne 382-406) doit être modifiée pour utiliser un appel RPC SECURITY DEFINER qui vérifie uniquement la validité du token SANS exposer les données sensibles. Voir Tâche 0.3.

---

### TACHE 0.2 : Créer le middleware Next.js

**Problème exact :**
Aucune protection serveur. Les pages protégées sont accessibles brièvement avant que le client-side `OrganizationProvider` ne redirige. Les Server Components des routes protégées n'ont aucune vérification de session.

**Fichier à créer :**
`middleware.ts` (racine du projet, à côté de `next.config.ts`)

**Code exact :**
```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password"];
const ONBOARDING_ROUTES = ["/onboarding-flow"];
const INVITE_ROUTES = ["/invite"];
const AUTH_ROUTES = ["/auth"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Laisser passer les routes auth callback
  if (AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
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

  // Refresh session (important pour garder la session active)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  const isInviteRoute = INVITE_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  const isOnboardingRoute = ONBOARDING_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  // Route publique + user connecté → rediriger vers /global
  if (isPublicRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/global";
    return NextResponse.redirect(url);
  }

  // Route protégée + user non connecté → rediriger vers /login
  if (!isPublicRoute && !isInviteRoute && !isOnboardingRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // Route invite : laisser passer (la page gère l'état connecté/non connecté)
  // Route onboarding : laisser passer si connecté, sinon login
  if (isOnboardingRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match toutes les routes sauf :
     * - _next/static (fichiers statiques)
     * - _next/image (optimisation images)
     * - favicon.ico, sitemap.xml, robots.txt
     * - fichiers publics (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**Fichier à vérifier :**
`lib/supabase/server.ts` — s'assurer que `createServerClient` est correctement configuré pour le middleware. Si ce fichier utilise `cookies()` de Next.js, le middleware a besoin de sa propre instanciation (comme ci-dessus).

**Validation :**
1. Déconnecte-toi → visite `/global` → doit rediriger vers `/login?redirectTo=/global`
2. Connecte-toi → visite `/login` → doit rediriger vers `/global`
3. Non connecté → visite `/invite/abc` → doit passer (pas de redirect)
4. Non connecté → visite `/onboarding-flow` → doit rediriger vers `/login`

**Piège connu :**
Le middleware et `OrganizationProvider` vont tous les deux essayer de rediriger. Il faut s'assurer qu'il n'y a pas de boucle de redirect. Le middleware gère uniquement l'authentification (connecté/non-connecté). Le `OrganizationProvider` gère la logique métier (a une org / n'a pas d'org → onboarding).

**Impact sur le code existant :**
- `OrganizationProvider` (ligne 51-55) : le check `if (!user)` peut être simplifié car le middleware garantit déjà qu'un user est authentifié sur les routes protégées. Mais garder le check comme garde de sécurité.
- Login page (ligne 28) : lit `redirectTo` depuis les searchParams → compatible avec le middleware qui ajoute `?redirectTo=`.

---

### TACHE 0.3 : RPC sécurisé pour consulter et accepter une invitation

**Problème exact :**
Actuellement, `getInvitationByToken` et `acceptInvitation` sont des opérations client-side qui dépendent des policies RLS. Avec la correction de la Tâche 0.1, un utilisateur non connecté ne peut plus voir l'invitation par token. Il faut une RPC SECURITY DEFINER.

**Fichier à créer :**
`supabase/migrations/YYYYMMDDHHMMSS_create_invitation_rpcs.sql`

**SQL exact :**
```sql
-- RPC 1 : Consulter une invitation par token (accessible sans être membre de l'org)
-- Retourne les infos publiques nécessaires à la page /invite/[token]
-- NE retourne PAS le token lui-même ni l'email complet (juste masqué)
CREATE OR REPLACE FUNCTION get_invitation_details(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_masked_email TEXT;
BEGIN
  SELECT
    i.id,
    i.email,
    i.role,
    i.expires_at,
    i.accepted_at,
    i.created_at,
    o.name AS organization_name,
    o.logo_url AS organization_logo_url
  INTO v_invitation
  FROM organization_invitations i
  JOIN organizations o ON o.id = i.organization_id
  WHERE i.token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  IF v_invitation.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'already_accepted');
  END IF;

  IF v_invitation.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;

  -- Masquer partiellement l'email : a***e@gmail.com
  v_masked_email := substring(v_invitation.email from 1 for 1)
    || '***'
    || substring(v_invitation.email from position('@' in v_invitation.email) - 1 for 1)
    || substring(v_invitation.email from position('@' in v_invitation.email));

  RETURN jsonb_build_object(
    'valid', true,
    'email', v_invitation.email,
    'masked_email', v_masked_email,
    'role', v_invitation.role,
    'expires_at', v_invitation.expires_at,
    'organization_name', v_invitation.organization_name,
    'organization_logo_url', v_invitation.organization_logo_url
  );
END;
$$;

-- RPC 2 : Accepter une invitation (atomique, sécurisé)
CREATE OR REPLACE FUNCTION accept_invitation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_invitation RECORD;
  v_org RECORD;
BEGIN
  -- Vérifier que l'utilisateur est authentifié
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Récupérer l'email de l'utilisateur
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- Récupérer l'invitation avec verrouillage
  SELECT * INTO v_invitation
  FROM organization_invitations
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invitation_not_found');
  END IF;

  IF v_invitation.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_accepted');
  END IF;

  IF v_invitation.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;

  -- Vérifier que l'email correspond
  IF lower(v_invitation.email) <> lower(v_user_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'email_mismatch',
      'expected_email', v_invitation.email);
  END IF;

  -- Vérifier que l'utilisateur n'est pas déjà membre
  IF EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = v_user_id AND organization_id = v_invitation.organization_id
  ) THEN
    -- Marquer l'invitation comme acceptée quand même
    UPDATE organization_invitations SET accepted_at = now() WHERE id = v_invitation.id;
    RETURN jsonb_build_object('success', false, 'error', 'already_member');
  END IF;

  -- Ajouter le membre à l'organisation
  INSERT INTO user_organizations (user_id, organization_id, role, is_default)
  VALUES (v_user_id, v_invitation.organization_id, v_invitation.role, false);

  -- Marquer l'invitation comme acceptée
  UPDATE organization_invitations
  SET accepted_at = now()
  WHERE id = v_invitation.id;

  -- Récupérer les infos de l'organisation
  SELECT id, name, slug, logo_url INTO v_org
  FROM organizations WHERE id = v_invitation.organization_id;

  RETURN jsonb_build_object(
    'success', true,
    'organization', jsonb_build_object(
      'id', v_org.id,
      'name', v_org.name,
      'slug', v_org.slug,
      'logo_url', v_org.logo_url
    ),
    'role', v_invitation.role
  );
END;
$$;
```

**Fichier à modifier :**
`lib/supabase/queries/organizations.ts`

**Modifications exactes :**

1. Remplacer `getInvitationByToken` (lignes 382-406) par :
```typescript
export async function getInvitationByToken(token: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_invitation_details", {
    p_token: token,
  });

  if (error || !data || !data.valid) {
    return null;
  }

  return data as {
    valid: boolean;
    email: string;
    masked_email: string;
    role: string;
    expires_at: string;
    organization_name: string;
    organization_logo_url: string | null;
  };
}
```

2. Remplacer `acceptInvitation` (lignes 288-359) par :
```typescript
export async function acceptInvitation(token: string): Promise<{
  organization: Organization;
}> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("accept_invitation", {
    p_token: token,
  });

  if (error) {
    throw new Error("Erreur lors de l'acceptation de l'invitation");
  }

  if (!data.success) {
    const messages: Record<string, string> = {
      invitation_not_found: "Invitation invalide ou expirée",
      already_accepted: "Cette invitation a déjà été acceptée",
      expired: "Cette invitation a expiré",
      email_mismatch: `Cette invitation est destinée à ${data.expected_email}`,
      already_member: "Vous êtes déjà membre de cette organisation",
    };
    throw new Error(messages[data.error] || "Erreur inconnue");
  }

  return {
    organization: {
      id: data.organization.id,
      name: data.organization.name,
      slug: data.organization.slug,
      logo_url: data.organization.logo_url,
      role: data.role as "admin" | "member",
    },
  };
}
```

**Fichier à modifier :**
`app/invite/[token]/page.tsx`

**Modifications exactes :**
- Ligne 71-75 : Adapter le mapping des données d'invitation au nouveau format RPC :
```typescript
// AVANT :
setInvitation({
  email: invitationData.email,
  role: invitationData.role ?? "",
  organizationName: invitationData.organization.name,
  expiresAt: invitationData.expires_at ?? "",
});

// APRES :
setInvitation({
  email: invitationData.email,
  role: invitationData.role ?? "",
  organizationName: invitationData.organization_name,
  expiresAt: invitationData.expires_at ?? "",
});
```

**Validation :**
1. Crée une invitation depuis settings/members
2. Copie le token depuis la base : `SELECT token FROM organization_invitations ORDER BY created_at DESC LIMIT 1`
3. Visite `/invite/[token]` non connecté → doit afficher les infos de l'org (nom, rôle)
4. Connecte-toi avec le bon email → accepte → doit rejoindre l'org
5. Re-visite le même lien → doit afficher "déjà acceptée"
6. Teste avec un email différent → doit afficher le message d'erreur

---

## PHASE 1 : EMAIL D'INVITATION

### TACHE 1.0 : Décision préalable — choix du provider email

**A décider AVANT de coder :**

| Option | Avantages | Inconvénients |
|--------|-----------|---------------|
| **Resend** | SDK simple, bonne réputation, gratuit jusqu'à 100/jour, templates React Email | Nécessite domaine vérifié pour la production |
| **Supabase Auth emails** | Intégré, pas de config supplémentaire | Limité aux emails auth (pas d'emails custom) |
| **Edge Function + SMTP** | Flexible | Plus complexe, maintenance SMTP |

**Recommandation : Resend** avec React Email pour les templates.

**Prérequis avant de passer à 1.1 :**
1. Créer un compte Resend (https://resend.com)
2. Ajouter le domaine et vérifier DNS (SPF, DKIM, DMARC)
3. Récupérer la clé API
4. Stocker la clé dans les secrets Supabase : `RESEND_API_KEY`

---

### TACHE 1.1 : Edge Function d'envoi d'email d'invitation

**Prérequis :** Tâche 1.0 complétée (Resend configuré, clé API dans les secrets)

**Fichier à créer :**
`supabase/functions/send-invitation-email/index.ts`

**Code exact :**
```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://app.istock.fr";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@istock.fr";

interface InvitationPayload {
  email: string;
  token: string;
  organization_name: string;
  role: string;
  invited_by_name?: string;
}

Deno.serve(async (req: Request) => {
  // Vérifier la méthode
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Vérifier le header Authorization (appel interne uniquement)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const payload: InvitationPayload = await req.json();
    const { email, token, organization_name, role, invited_by_name } = payload;

    if (!email || !token || !organization_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const inviteUrl = `${APP_URL}/invite/${token}`;
    const roleLabel = role === "admin" ? "Administrateur" : "Membre";
    const inviterText = invited_by_name
      ? `${invited_by_name} vous invite`
      : "Vous êtes invité(e)";

    const htmlBody = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="font-size: 20px; font-weight: 600; color: #18181b; margin: 0 0 8px;">
      Rejoindre ${organization_name}
    </h1>
    <p style="color: #71717a; font-size: 14px; margin: 0 0 24px;">
      ${inviterText} à rejoindre <strong>${organization_name}</strong> sur iStock en tant que <strong>${roleLabel}</strong>.
    </p>
    <a href="${inviteUrl}"
       style="display: inline-block; background-color: #18181b; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">
      Accepter l'invitation
    </a>
    <p style="color: #a1a1aa; font-size: 12px; margin: 24px 0 0;">
      Ce lien expire dans 7 jours. Si vous n'avez pas demandé cette invitation, ignorez cet email.
    </p>
    <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;">
    <p style="color: #a1a1aa; font-size: 11px; margin: 0;">
      iStock — Gestion de stock intelligente
    </p>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `iStock <${FROM_EMAIL}>`,
        to: [email],
        subject: `Invitation à rejoindre ${organization_name} sur iStock`,
        html: htmlBody,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error("Resend error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to send email" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = await res.json();
    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
```

**Déploiement :**
```bash
supabase functions deploy send-invitation-email --no-verify-jwt
```

Note : `--no-verify-jwt` car cette function sera appelée depuis le client avec le token auth du user. Alternativement, garder `verify-jwt` et passer le token auth dans le header — c'est préférable pour la sécurité.

**Validation :**
1. Appeler la function via curl avec un payload de test
2. Vérifier la réception de l'email
3. Vérifier que le lien dans l'email pointe vers la bonne URL
4. Vérifier les headers SPF/DKIM (pas de spam)

---

### TACHE 1.2 : Intégrer l'envoi d'email dans le flux d'invitation

**Prérequis :** Tâche 1.1 déployée et testée

**Fichier à modifier :**
`lib/supabase/queries/organizations.ts`

**Modification exacte de `inviteUserToOrganization` (lignes 228-258) :**

```typescript
export async function inviteUserToOrganization(
  organizationId: string,
  email: string,
  role: "admin" | "member" = "member"
): Promise<OrganizationInvitation> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Créer l'invitation en base
  const { data, error } = await supabase
    .from("organization_invitations")
    .insert({
      organization_id: organizationId,
      email: email.toLowerCase(),
      role,
      invited_by: user?.id || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Une invitation a déjà été envoyée à cet email");
    }
    throw new Error(`Erreur lors de l'invitation: ${error.message}`);
  }

  // 2. Récupérer le nom de l'organisation pour l'email
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .single();

  // 3. Récupérer le nom de l'inviteur
  const inviterName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.first_name ||
    user?.email ||
    "Quelqu'un";

  // 4. Envoyer l'email via Edge Function
  try {
    await supabase.functions.invoke("send-invitation-email", {
      body: {
        email: email.toLowerCase(),
        token: data.token,
        organization_name: org?.name || "Organisation",
        role,
        invited_by_name: inviterName,
      },
    });
  } catch (emailError) {
    // L'invitation est créée même si l'email échoue
    // L'admin peut toujours copier le lien manuellement
    console.error("Erreur envoi email invitation:", emailError);
  }

  return data;
}
```

**Fichier à modifier :**
`app/(protected)/settings/members/page.tsx`

**Ajout** après l'appel `inviteMutation.mutateAsync()` réussi (dans le handler `handleInvite`) :
Ajouter un toast de succès qui mentionne l'email :
```typescript
toast.success(`Invitation envoyée à ${inviteEmail}`);
```

**Validation :**
1. Va dans settings/members → invite un email
2. Vérifie que l'email est reçu avec le bon lien
3. Vérifie que si l'Edge Function échoue, l'invitation est quand même créée en base
4. Vérifie que le lien dans l'email fonctionne

---

## PHASE 2 : UX INVITATION & REGISTER

### TACHE 2.1 : Page register — supporter les query params email et returnUrl

**Problème exact :**
La page `/invite/[token]` (ligne 273) redirige vers `/register?email=...&returnUrl=/invite/[token]` mais la page register ne lit PAS ces paramètres.

**Fichier à modifier :**
`app/(public)/register/page.tsx`

**Modifications exactes :**

1. Après la déclaration du composant, ajouter la lecture des searchParams :
```typescript
// Ajouter dans les imports :
import { useSearchParams } from "next/navigation";

// Dans le composant, après les hooks existants :
const searchParams = useSearchParams();
const prefillEmail = searchParams.get("email") || "";
const returnUrl = searchParams.get("returnUrl") || "";
```

2. Modifier le `emailRedirectTo` dans `signUp` (ligne 52) :
```typescript
// AVANT :
emailRedirectTo: `${window.location.origin}/auth/callback`

// APRES :
emailRedirectTo: `${window.location.origin}/auth/callback${
  returnUrl ? `?next=${encodeURIComponent(returnUrl)}` : ""
}`
```

3. Pré-remplir le champ email dans le form (utiliser `defaultValues` du react-hook-form) :
```typescript
// Dans useForm, ajouter/modifier defaultValues :
defaultValues: {
  firstName: "",
  lastName: "",
  email: prefillEmail,
  password: "",
}
```

**Validation :**
1. Visite `/register?email=test@example.com&returnUrl=/invite/abc123`
2. Le champ email doit être pré-rempli avec `test@example.com`
3. Après inscription + confirmation email, le callback doit rediriger vers `/invite/abc123`
4. Visite `/register` sans params → comportement normal inchangé

---

### TACHE 2.2 : Login — supporter le param returnUrl en plus de redirectTo

**Problème exact :**
La page login lit `redirectTo` (ligne 28) mais la page invite redirige vers `/login?returnUrl=...` (ligne 113). Il y a une incohérence de nommage.

**Fichier à modifier :**
`app/invite/[token]/page.tsx`

**Modification exacte (ligne 113) :**
```typescript
// AVANT :
router.push(`/login?returnUrl=/invite/${token}`);

// APRES :
router.push(`/login?redirectTo=/invite/${token}`);
```

C'est plus simple de corriger l'émetteur que de modifier le récepteur.

**Validation :**
1. Non connecté → visite `/invite/[token]` → clique "Se connecter"
2. Doit être redirigé vers `/login?redirectTo=/invite/[token]`
3. Après login → doit être redirigé vers `/invite/[token]`

---

### TACHE 2.3 : Skip onboarding pour les utilisateurs invités

**Problème exact :**
Quand un nouvel utilisateur s'inscrit via une invitation et accepte, il est ajouté à l'org invitante. Mais `OrganizationProvider` ne recharge pas les organisations immédiatement. Et si le user a déjà accepté l'invitation AVANT que le provider ne charge, tout va bien. Mais si l'utilisateur s'inscrit et arrive sur `/global` AVANT d'avoir accepté l'invitation (parce que le callback redirige vers `/global` par défaut), il sera renvoyé vers l'onboarding.

Le fix du `returnUrl` dans la Tâche 2.1 résout partiellement ce problème (le callback redirige vers `/invite/[token]`). Mais il faut aussi gérer le cas où l'utilisateur arrive sur `/global` après avoir accepté une invitation.

**Fichier à modifier :**
`components/organization-provider.tsx`

**Modification exacte :**
Dans le `useEffect` principal, après le chargement des organisations (aux alentours des lignes 58-67), modifier la logique :

```typescript
// AVANT (lignes 62-67) :
if (orgs.length === 0 && !isOnboardingRoute) {
  setShouldRedirect(true);
  window.location.href = "/onboarding-flow";
  return;
}

// APRES :
if (orgs.length === 0 && !isOnboardingRoute) {
  // Vérifier si l'utilisateur a des invitations en attente
  // Si oui, ne pas forcer l'onboarding — il peut accepter ses invitations
  const isInviteRoute = pathname.startsWith("/invite");
  if (!isInviteRoute) {
    setShouldRedirect(true);
    window.location.href = "/onboarding-flow";
    return;
  }
}
```

Le vrai fix est que `/invite` est déjà dans `ONBOARDING_ROUTES` (ligne 19 : `const ONBOARDING_ROUTES = ["/onboarding-flow", "/invite"]`). Donc le provider ne redirige PAS si on est sur `/invite`. Le flux est déjà correct :

1. User s'inscrit → callback redirige vers `/invite/[token]` (grâce à Tâche 2.1)
2. `/invite` est dans ONBOARDING_ROUTES → pas de redirect vers onboarding
3. User accepte l'invitation → l'org est ajoutée
4. `acceptInvitation` redirige vers `/global`
5. OrganizationProvider recharge les orgs → trouve l'org invitée → OK

**Mais il y a un cas edge** : si le user arrive sur `/global` directement (ex: il tape l'URL) APRES avoir accepté l'invitation mais AVANT que le provider ait rechargé. Le fix est dans le listener `SIGNED_IN` (lignes 90-104) qui appelle `loadOrganizations()`. Ceci recharge les orgs et le provider trouvera l'org invitée.

**Validation :**
1. Crée une invitation pour un email non-inscrit
2. Visite `/invite/[token]` → clique "Créer un compte"
3. Inscris-toi avec l'email invité
4. Confirme l'email → doit être redirigé vers `/invite/[token]`
5. Accepte l'invitation → doit être redirigé vers `/global` avec l'org chargée
6. NE DOIT PAS passer par l'onboarding

---

### TACHE 2.4 : Page "Mes invitations reçues"

**Fichier à créer :**
`app/(protected)/settings/invitations/page.tsx`

**Comportement attendu :**
- Lister toutes les invitations en attente pour l'email du user connecté
- Pour chaque invitation : nom de l'org, rôle proposé, date d'expiration, bouton "Accepter" / "Refuser"
- Accepter = appel RPC `accept_invitation` → recharger les orgs dans le store → toast succès
- Refuser = ne rien faire côté base (l'invitation expire naturellement) ou marquer comme refusée (nécessite un champ `declined_at`)

**Query à ajouter dans `lib/supabase/queries/organizations.ts` :**
```typescript
export async function getMyPendingInvitations() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return [];

  const { data, error } = await supabase
    .from("organization_invitations")
    .select("*, organization:organizations(name, logo_url)")
    .eq("email", user.email.toLowerCase())
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) return [];
  return data || [];
}
```

Note : cette query fonctionne car la Tâche 0.1 ajoute une policy "Users can view own invitations" basée sur l'email.

**Query key à ajouter dans `lib/query-keys.ts` :**
```typescript
// Dans l'objet organizations :
myInvitations: () => [...queryKeys.organizations.all, "my-invitations"] as const,
```

**Lien de navigation à ajouter :**
Dans `app/(protected)/more/page.tsx`, ajouter un lien vers `/settings/invitations` dans la liste de navigation (après "Équipe") :
```typescript
{ name: "Mes invitations", href: "/settings/invitations", icon: Mail },
```

**Validation :**
1. Invite un email → connecte-toi avec cet email
2. Va dans settings/invitations → l'invitation doit apparaître
3. Accepte → l'org doit apparaître dans le switcher
4. L'invitation doit disparaître de la liste

---

## PHASE 3 : GESTION D'ORGANISATION AVANCEE

### TACHE 3.1 : Quitter une organisation

**Fichier à créer (migration) :**
`supabase/migrations/YYYYMMDDHHMMSS_create_leave_organization_rpc.sql`

```sql
CREATE OR REPLACE FUNCTION leave_organization(p_organization_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_member_count INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Vérifier le membership
  SELECT role INTO v_role
  FROM user_organizations
  WHERE user_id = v_user_id AND organization_id = p_organization_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_member');
  END IF;

  -- Un owner ne peut pas quitter sans transférer
  IF v_role = 'owner' THEN
    -- Compter les autres membres
    SELECT count(*) INTO v_member_count
    FROM user_organizations
    WHERE organization_id = p_organization_id AND user_id <> v_user_id;

    IF v_member_count > 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'owner_must_transfer',
        'message', 'Transférez la propriété avant de quitter');
    ELSE
      -- Dernier membre = supprimer l'organisation entière
      DELETE FROM organizations WHERE id = p_organization_id;
      RETURN jsonb_build_object('success', true, 'action', 'organization_deleted');
    END IF;
  END IF;

  -- Supprimer le membership
  DELETE FROM user_organizations
  WHERE user_id = v_user_id AND organization_id = p_organization_id;

  RETURN jsonb_build_object('success', true, 'action', 'left');
END;
$$;
```

**Fichier à ajouter (query) :**
Ajouter dans `lib/supabase/queries/organizations.ts` :
```typescript
export async function leaveOrganization(organizationId: string): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("leave_organization", {
    p_organization_id: organizationId,
  });

  if (error) {
    throw new Error(`Erreur: ${error.message}`);
  }

  if (!data.success) {
    const messages: Record<string, string> = {
      not_member: "Vous n'êtes pas membre de cette organisation",
      owner_must_transfer:
        "Vous devez transférer la propriété avant de quitter",
    };
    throw new Error(messages[data.error] || data.message || "Erreur inconnue");
  }
}
```

**Fichier à ajouter (mutation) :**
Ajouter dans `hooks/mutations/use-organization-mutations.ts` :
```typescript
export function useLeaveOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (organizationId: string) => leaveOrganization(organizationId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.organizations.list(),
      });
    },
  });
}
```

**Fichier à modifier :**
`app/(protected)/settings/organizations/page.tsx`

Ajouter un bouton "Quitter" pour chaque org où le user n'est PAS owner. Avec dialog de confirmation. Après avoir quitté :
- Si c'était l'org courante → `switchOrganization` vers la première org restante
- Si c'était la dernière org → redirect vers `/onboarding-flow`

**Validation :**
1. Un member quitte une org → il ne la voit plus dans le switcher
2. Un admin quitte une org → idem
3. Un owner essaie de quitter avec d'autres membres → erreur "transférez d'abord"
4. Un owner seul quitte → l'org est supprimée
5. Un user quitte sa dernière org → redirigé vers onboarding

---

### TACHE 3.2 : Transférer la propriété

**Fichier à créer (migration) :**
`supabase/migrations/YYYYMMDDHHMMSS_create_transfer_ownership_rpc.sql`

```sql
CREATE OR REPLACE FUNCTION transfer_ownership(
  p_organization_id UUID,
  p_new_owner_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_current_role TEXT;
  v_target_role TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Vérifier que l'appelant est owner
  SELECT role INTO v_current_role
  FROM user_organizations
  WHERE user_id = v_user_id AND organization_id = p_organization_id;

  IF v_current_role <> 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_owner');
  END IF;

  -- Vérifier que le target est membre de l'org
  SELECT role INTO v_target_role
  FROM user_organizations
  WHERE user_id = p_new_owner_id AND organization_id = p_organization_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'target_not_member');
  END IF;

  -- Ne peut pas transférer à soi-même
  IF v_user_id = p_new_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'same_user');
  END IF;

  -- Transférer : ancien owner → admin, nouveau owner → owner
  UPDATE user_organizations
  SET role = 'admin'
  WHERE user_id = v_user_id AND organization_id = p_organization_id;

  UPDATE user_organizations
  SET role = 'owner'
  WHERE user_id = p_new_owner_id AND organization_id = p_organization_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
```

**Query + mutation :** même pattern que Tâche 3.1.

**UI :** Ajouter dans settings/organizations ou settings/members un bouton "Transférer la propriété" visible uniquement pour l'owner. Dialog avec liste déroulante des membres, confirmation en deux étapes (re-saisir le nom de l'org).

**Validation :**
1. Owner transfère à un admin → l'admin devient owner, l'ancien owner devient admin
2. Owner transfère à un member → idem
3. Non-owner essaie → erreur
4. Les permissions du nouveau owner fonctionnent (peut modifier l'org, supprimer, etc.)

---

### TACHE 3.3 : Afficher les metadata des membres (email, nom, avatar)

**Problème exact :**
`getOrganizationMembers` (ligne 162-180 de organizations.ts) fait un `select("*")` sur `user_organizations` mais ne peut PAS joindre `auth.users` car cette table n'est pas exposée via l'API Supabase (schéma `auth`, pas `public`).

**Solution : créer une vue dans le schéma public.**

**Fichier à créer (migration) :**
`supabase/migrations/YYYYMMDDHHMMSS_create_members_view.sql`

```sql
-- Vue qui expose les infos nécessaires des membres
CREATE OR REPLACE VIEW public.organization_members_view AS
SELECT
  uo.id,
  uo.user_id,
  uo.organization_id,
  uo.role,
  uo.is_default,
  uo.created_at AS joined_at,
  u.email,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    CONCAT(
      u.raw_user_meta_data->>'first_name',
      ' ',
      u.raw_user_meta_data->>'last_name'
    ),
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1)
  ) AS display_name,
  u.raw_user_meta_data->>'avatar_url' AS avatar_url
FROM user_organizations uo
JOIN auth.users u ON u.id = uo.user_id;

-- RLS sur la vue : même logique que user_organizations
-- Les vues héritent PAS automatiquement des policies de la table sous-jacente
-- Il faut soit :
-- a) Utiliser SECURITY INVOKER (default dans PG15+) et les policies de user_organizations s'appliquent
-- b) Créer une function RPC

-- Option a est suffisante car la vue fait un JOIN sur user_organizations
-- qui a déjà des policies RLS. Supabase utilise SECURITY INVOKER par défaut.
-- Mais pour être sûr, on peut ajouter un grant explicite :
GRANT SELECT ON public.organization_members_view TO authenticated;
```

**Fichier à modifier :**
`lib/supabase/queries/organizations.ts` — remplacer `getOrganizationMembers` :

```typescript
export interface OrganizationMember {
  id: string;
  user_id: string;
  organization_id: string;
  role: string | null;
  is_default: boolean | null;
  joined_at: string | null;
  email: string;
  display_name: string;
  avatar_url: string | null;
}

export async function getOrganizationMembers(
  organizationId: string
): Promise<OrganizationMember[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("organization_members_view")
    .select("*")
    .eq("organization_id", organizationId)
    .order("joined_at", { ascending: true });

  if (error) {
    throw new Error(
      `Erreur lors de la récupération des membres: ${error.message}`
    );
  }

  return data || [];
}
```

**Fichier à modifier :**
`app/(protected)/settings/members/page.tsx` — mettre à jour l'affichage des membres pour utiliser `email`, `display_name` et `avatar_url` au lieu de `user_id`.

**Validation :**
1. Va dans settings/members → les membres doivent afficher email + nom + avatar
2. Un membre voit les autres membres de son org
3. Un membre ne voit PAS les membres d'une autre org

**Piège connu :**
La vue `organization_members_view` joint `auth.users`. Si Supabase traite la vue comme SECURITY INVOKER (par défaut en PG15+), les policies RLS de `user_organizations` s'appliquent. Mais `auth.users` est dans un schéma protégé. La vue étant créée par le superuser via migration, elle a accès à `auth.users`. Tester en production pour vérifier.

**Alternative si la vue ne fonctionne pas :**
Créer une RPC SECURITY DEFINER `get_organization_members(p_org_id UUID)` qui fait le JOIN manuellement et vérifie que l'appelant est membre de l'org.

---

## PHASE 4 : POLISH & FINITIONS

### TACHE 4.1 : Org switcher dans le header desktop

**Problème :** Le switcher n'existe que dans `/more` (mobile). Sur desktop, il faut un dropdown dans le header.

**Fichier à créer :**
`components/layout/header/org-switcher.tsx`

**Comportement :**
- Dropdown (Radix `DropdownMenu`) avec le logo/nom de l'org courante
- Liste des orgs avec checkmark sur l'active
- Click → `switchOrganization(orgId)` + `setDefaultOrganization(orgId)` + `queryClient.removeQueries()`
- Utiliser le hook `useSwitchOrganization` existant de `organization-provider.tsx`

**Fichier à modifier :**
`components/layout/header/index.tsx` — ajouter `<OrgSwitcher />` entre le bouton sidebar et le search.

---

### TACHE 4.2 : Renvoyer une invitation

**Fichier à modifier :**
`app/(protected)/settings/members/page.tsx`

**Comportement :**
- Bouton "Renvoyer" à côté de chaque invitation en attente
- Action : supprimer l'ancienne invitation + créer une nouvelle (nouveau token, nouvelle expiration) + envoyer le nouvel email
- Ou plus simplement : ré-appeler l'Edge Function avec le token existant (si l'invitation n'est pas expirée)

**Implementation simplifiée :**
Ajouter une function `resendInvitation` qui appelle l'Edge Function `send-invitation-email` avec le token existant :

```typescript
export async function resendInvitationEmail(
  invitation: OrganizationInvitation,
  organizationName: string
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.functions.invoke("send-invitation-email", {
    body: {
      email: invitation.email,
      token: invitation.token,
      organization_name: organizationName,
      role: invitation.role,
      invited_by_name:
        user?.user_metadata?.full_name || user?.email || "Quelqu'un",
    },
  });
}
```

---

### TACHE 4.3 : Sécuriser les buckets storage

**Problème constaté :**
Les buckets `product-images` et `organization-logos` sont publics avec **aucune restriction** de taille ni de type MIME. N'importe qui peut upload n'importe quoi.

**Fix via Supabase Dashboard ou migration :**
```sql
UPDATE storage.buckets
SET file_size_limit = 2097152,  -- 2MB
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']
WHERE name IN ('product-images', 'organization-logos');
```

---

### TACHE 4.4 : Contrainte CHECK sur le rôle

**Migration :**
```sql
ALTER TABLE user_organizations
  ADD CONSTRAINT check_role CHECK (role IN ('owner', 'admin', 'member'));
```

**Risque :** Vérifier qu'aucune donnée existante ne viole la contrainte avant d'appliquer.

---

## ANNEXE : STRATEGIE DE TEST

### Tests manuels critiques pour le flux d'invitation

Chaque scénario doit être testé manuellement après chaque phase :

| # | Scénario | Étapes | Résultat attendu |
|---|----------|--------|------------------|
| T1 | Invite user existant, bon email | Admin invite → user connecté accepte | User ajouté à l'org, visible dans members |
| T2 | Invite user existant, mauvais email | Admin invite email-A → user connecté avec email-B visite le lien | Warning "invitation destinée à email-A", bouton accepter désactivé |
| T3 | Invite user non-inscrit | Admin invite → user non-inscrit visite le lien | Affiche "créer un compte", pré-remplit email, callback redirige vers invite |
| T4 | Invitation expirée | Modifier expires_at en base → visiter le lien | Affiche "invitation invalide ou expirée" |
| T5 | Double acceptation | Accepter → re-visiter le lien | Affiche "déjà acceptée" |
| T6 | User déjà membre | Inviter un user qui est déjà membre | Erreur "déjà membre" (ou doublon UNIQUE violation) |
| T7 | Quitter la dernière org | User quitte sa seule org | Redirigé vers onboarding |
| T8 | Owner quitte avec membres | Owner essaie de quitter | Erreur "transférez d'abord" |
| T9 | Transfert ownership | Owner transfère à admin | Rôles échangés correctement |
| T10 | Multi-org switch | User dans 2 orgs → switch | Données changent, cache invalidé |
| T11 | RLS invitations | User lambda → SELECT * organization_invitations | Ne voit que SES invitations |
| T12 | Middleware redirect | Non-auth visite /global | Redirigé vers /login?redirectTo=/global |

---

## ANNEXE : ORDRE D'EXECUTION STRICT

```
PHASE 0 (sécurité) :
  0.1 Fix RLS invitations          ← PREMIER, bloque tout le reste
  0.2 Middleware Next.js            ← Indépendant de 0.1
  0.3 RPCs invitation sécurisés    ← Dépend de 0.1

PHASE 1 (email) :
  1.0 Décision provider email      ← Décision humaine, pas de code
  1.1 Edge Function email          ← Dépend de 1.0
  1.2 Intégrer email dans le flux  ← Dépend de 1.1

PHASE 2 (UX) :
  2.1 Register query params        ← Indépendant
  2.2 Login param fix              ← Indépendant
  2.3 Skip onboarding invités      ← Dépend de 2.1 + 2.2
  2.4 Page "mes invitations"       ← Dépend de 0.1 (policy)

PHASE 3 (gestion org) :
  3.1 Quitter une org              ← Indépendant
  3.2 Transférer propriété         ← Indépendant
  3.3 Metadata membres (vue)       ← Indépendant

PHASE 4 (polish) :
  4.1 Org switcher header          ← Indépendant
  4.2 Renvoyer invitation          ← Dépend de 1.1
  4.3 Sécuriser buckets storage    ← Indépendant
  4.4 Contrainte CHECK rôle        ← Indépendant
```

Tâches parallélisables au sein d'une phase :
- Phase 0 : 0.1 et 0.2 en parallèle, puis 0.3
- Phase 2 : 2.1 et 2.2 en parallèle, puis 2.3, puis 2.4
- Phase 3 : 3.1, 3.2, 3.3 toutes en parallèle
- Phase 4 : toutes en parallèle
