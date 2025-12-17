"use client";

import { useEffect, useState } from "react";
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
import {
  getInvitationByToken,
  acceptInvitation,
} from "@/lib/supabase/queries/organizations";
import { createClient } from "@/lib/supabase/client";

type InvitationStatus = "loading" | "valid" | "invalid" | "accepted" | "error";

interface InvitationData {
  email: string;
  role: string;
  organizationName: string;
  expiresAt: string;
}

export default function AcceptInvitationPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [status, setStatus] = useState<InvitationStatus>("loading");
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    async function checkInvitation() {
      try {
        // Check if user is logged in
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        setIsLoggedIn(!!user);
        setUserEmail(user?.email || null);

        // Fetch invitation details
        const invitationData = await getInvitationByToken(token);

        if (!invitationData) {
          setStatus("invalid");
          return;
        }

        // Check if expired
        if (new Date(invitationData.expires_at) < new Date()) {
          setStatus("invalid");
          return;
        }

        setInvitation({
          email: invitationData.email,
          role: invitationData.role,
          organizationName: invitationData.organization.name,
          expiresAt: invitationData.expires_at,
        });
        setStatus("valid");
      } catch (error) {
        setStatus("error");
      }
    }

    if (token) {
      checkInvitation();
    }
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;

    setIsAccepting(true);
    try {
      const result = await acceptInvitation(token);
      setStatus("accepted");
      toast.success(`Bienvenue dans ${result.organization.name} !`);

      // Redirect to global page after 2 seconds
      setTimeout(() => {
        router.push("/global");
      }, 2000);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erreur lors de l'acceptation de l'invitation"
      );
      setIsAccepting(false);
    }
  };

  const handleLoginRedirect = () => {
    // Redirect to login with return URL
    router.push(`/login?returnUrl=/invite/${token}`);
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">
              Vérification de l'invitation...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="size-8 text-destructive" />
            </div>
            <CardTitle>Invitation invalide</CardTitle>
            <CardDescription>
              Cette invitation n'existe pas ou a expiré.
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
              Impossible de charger l'invitation. Veuillez réessayer.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button onClick={() => window.location.reload()}>Réessayer</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

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
              Vous êtes maintenant membre de {invitation?.organizationName}.
              Redirection en cours...
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // status === "valid"
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="size-8 text-primary" />
          </div>
          <CardTitle>Rejoindre l'organisation</CardTitle>
          <CardDescription>
            Vous avez été invité à rejoindre une organisation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {invitation && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Organisation
                </span>
                <span className="font-medium">
                  {invitation.organizationName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Rôle</span>
                <Badge variant="secondary">
                  {invitation.role === "admin" ? "Administrateur" : "Membre"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Invité pour
                </span>
                <div className="flex items-center gap-1">
                  <Mail className="size-3 text-muted-foreground" />
                  <span className="text-sm">{invitation.email}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Expire le
                </span>
                <span className="text-sm">
                  {new Date(invitation.expiresAt).toLocaleDateString("fr-FR")}
                </span>
              </div>
            </div>
          )}

          {isLoggedIn === false && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/20 p-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Vous devez vous connecter avec l'adresse{" "}
                <strong>{invitation?.email}</strong> pour accepter cette
                invitation.
              </p>
            </div>
          )}

          {isLoggedIn && userEmail !== invitation?.email && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/20 p-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Vous êtes connecté avec <strong>{userEmail}</strong>, mais cette
                invitation est destinée à <strong>{invitation?.email}</strong>.
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          {isLoggedIn === false ? (
            <>
              <Button onClick={handleLoginRedirect} className="w-full">
                Se connecter
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link href={`/register?email=${invitation?.email}&returnUrl=/invite/${token}`}>
                  Créer un compte
                </Link>
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={handleAccept}
                disabled={
                  isAccepting || userEmail !== invitation?.email
                }
                className="w-full"
              >
                {isAccepting && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Accepter l'invitation
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link href="/global">Annuler</Link>
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
