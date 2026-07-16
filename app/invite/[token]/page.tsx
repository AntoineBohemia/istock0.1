"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle, XCircle, Building2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getInvitationByToken, acceptInvitation } from "@/lib/supabase/queries/organizations";
import { createClient } from "@/lib/supabase/client";

type InvitationStatus =
  | "loading"
  | "valid"
  | "accepting"
  | "accepted"
  | "already_accepted"
  | "expired"
  | "invalid"
  | "error";

interface InvitationData {
  email: string;
  role: string;
  organizationName: string;
  expiresAt: string;
  userExists: boolean;
}

const roleLabel = (role: string) =>
  role === "admin" ? "Administrateur" : role === "guest" ? "Invité" : "Membre";

export default function AcceptInvitationPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [status, setStatus] = useState<InvitationStatus>("loading");
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const autoAcceptAttempted = useRef(false);

  useEffect(() => {
    async function checkAndAutoAccept() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        setIsLoggedIn(!!user);
        setUserEmail(user?.email || null);

        const invitationData = await getInvitationByToken(token);

        if (!invitationData) {
          setStatus("invalid");
          return;
        }

        if (!invitationData.valid) {
          if (invitationData.reason === "already_accepted") {
            setStatus("already_accepted");
          } else if (invitationData.reason === "expired") {
            setStatus("expired");
          } else {
            setStatus("invalid");
          }
          return;
        }

        const inv: InvitationData = {
          email: invitationData.email,
          role: invitationData.role ?? "",
          organizationName: invitationData.organization_name,
          expiresAt: invitationData.expires_at ?? "",
          userExists: invitationData.user_exists ?? false,
        };
        setInvitation(inv);

        // Auto-accept: logged in + email matches → accept immediately
        if (
          user &&
          user.email?.toLowerCase() === inv.email.toLowerCase() &&
          !autoAcceptAttempted.current
        ) {
          autoAcceptAttempted.current = true;
          setStatus("accepting");
          try {
            const result = await acceptInvitation(token);
            setStatus("accepted");
            toast.success(`Bienvenue dans ${result.organization.name} !`);
          } catch (error) {
            const msg = error instanceof Error ? error.message : "";
            // already_member or already_accepted (race with callback) — treat as success
            if (msg.includes("déjà membre") || msg.includes("déjà été acceptée")) {
              setStatus("accepted");
              toast.success(`Vous êtes déjà membre de ${inv.organizationName}`);
            } else {
              toast.error(msg || "Erreur lors de l'acceptation");
              setStatus("valid");
            }
          }
          return;
        }

        setStatus("valid");
      } catch {
        setStatus("error");
      }
    }

    if (token) {
      checkAndAutoAccept();
    }
  }, [token]);

  // Redirect after accepted
  useEffect(() => {
    if (status !== "accepted") return;
    const timeoutId = setTimeout(() => router.push("/actions"), 2000);
    return () => clearTimeout(timeoutId);
  }, [status, router]);

  const handleLogoutAndSwitch = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/login?redirectTo=/invite/${token}`);
  };

  // ── Loading / Accepting ──
  if (status === "loading" || status === "accepting") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">
              {status === "accepting"
                ? "Acceptation en cours..."
                : "Vérification de l'invitation..."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Already accepted ──
  if (status === "already_accepted") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle className="size-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle>Invitation déjà acceptée</CardTitle>
            <CardDescription>
              Cette invitation a déjà été utilisée. Connectez-vous pour accéder à
              l&apos;organisation.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button asChild>
              <Link href="/actions">Accéder à l&apos;application</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // ── Expired ──
  if (status === "expired") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="size-8 text-destructive" />
            </div>
            <CardTitle>Invitation expirée</CardTitle>
            <CardDescription>
              Cette invitation a expiré. Demandez à l&apos;administrateur de vous renvoyer une
              invitation.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button asChild>
              <Link href="/login">Retour à la connexion</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // ── Invalid (not found) ──
  if (status === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="size-8 text-destructive" />
            </div>
            <CardTitle>Invitation invalide</CardTitle>
            <CardDescription>Cette invitation n&apos;existe pas.</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button asChild>
              <Link href="/login">Retour à la connexion</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // ── Error ──
  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="size-8 text-destructive" />
            </div>
            <CardTitle>Une erreur est survenue</CardTitle>
            <CardDescription>
              Impossible de charger l&apos;invitation. Veuillez réessayer.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button onClick={() => window.location.reload()}>Réessayer</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // ── Accepted ──
  if (status === "accepted") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle className="size-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle>Invitation acceptée !</CardTitle>
            <CardDescription>
              Vous êtes maintenant membre de {invitation?.organizationName}. Redirection en cours...
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Valid — show single action ──
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="size-8 text-primary" />
          </div>
          <CardTitle>Rejoindre {invitation?.organizationName}</CardTitle>
          <CardDescription>
            Vous êtes invité en tant que {roleLabel(invitation?.role ?? "member")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {invitation && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Organisation</span>
                <span className="font-medium">{invitation.organizationName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Rôle</span>
                <Badge variant="secondary">{roleLabel(invitation.role)}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Email requis</span>
                <div className="flex items-center gap-1">
                  <Mail className="size-3 text-muted-foreground" />
                  <span className="text-sm">{invitation.email}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          {isLoggedIn === false ? (
            // Not logged in → single CTA
            invitation?.userExists ? (
              <Button
                onClick={() => router.push(`/login?redirectTo=/invite/${token}`)}
                className="w-full"
              >
                Se connecter avec {invitation.email}
              </Button>
            ) : (
              <Button asChild className="w-full">
                <Link
                  href={`/register?email=${encodeURIComponent(invitation?.email ?? "")}&returnUrl=/invite/${token}&orgName=${encodeURIComponent(invitation?.organizationName ?? "")}&orgRole=${encodeURIComponent(roleLabel(invitation?.role ?? "member"))}`}
                >
                  Créer un compte pour continuer
                </Link>
              </Button>
            )
          ) : (
            // Logged in but wrong email → single action
            <Button onClick={handleLogoutAndSwitch} className="w-full">
              Se connecter avec {invitation?.email}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
