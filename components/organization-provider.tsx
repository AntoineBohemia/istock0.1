"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import {
  getUserOrganizations,
  getDefaultOrganization,
  setDefaultOrganization,
} from "@/lib/supabase/queries/organizations";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

interface OrganizationProviderProps {
  children: React.ReactNode;
}

// Routes qui ne necessitent pas d'organisation
const ONBOARDING_ROUTES = ["/onboarding-flow", "/invite"];

export default function OrganizationProvider({
  children,
}: OrganizationProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const {
    currentOrganization,
    setCurrentOrganization,
    setOrganizations,
    setIsLoading,
  } = useOrganizationStore();

  // Verifier si on est sur une route d'onboarding
  const isOnboardingRoute = ONBOARDING_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  useEffect(() => {
    const loadOrganizations = async () => {
      setIsChecking(true);

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setIsLoading(false);
          setIsChecking(false);
          return;
        }

        // Charger toutes les organisations
        const orgs = await getUserOrganizations();
        setOrganizations(orgs);

        // Si pas d'organisation et pas deja sur onboarding, rediriger
        if (orgs.length === 0 && !isOnboardingRoute) {
          setShouldRedirect(true);
          // Utiliser window.location pour une redirection fiable
          window.location.href = "/onboarding-flow";
          return;
        }

        // Si pas d'organisation courante, prendre la par defaut ou la premiere
        if (!currentOrganization && orgs.length > 0) {
          const defaultOrg = await getDefaultOrganization();
          setCurrentOrganization(defaultOrg || orgs[0]);
        } else if (currentOrganization) {
          // Verifier que l'organisation courante est toujours valide
          const stillValid = orgs.find((o) => o.id === currentOrganization.id);
          if (!stillValid && orgs.length > 0) {
            setCurrentOrganization(orgs[0]);
          }
        }
      } catch (error) {
        console.error("Erreur lors du chargement des organisations:", error);
      } finally {
        setIsLoading(false);
        setIsChecking(false);
      }
    };

    loadOrganizations();

    // Ecouter les changements d'authentification
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        loadOrganizations();
      } else if (event === "SIGNED_OUT") {
        useOrganizationStore.getState().reset();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, isOnboardingRoute]);

  // Afficher un loader pendant la verification (sauf sur les routes d'onboarding)
  if ((isChecking || shouldRedirect) && !isOnboardingRoute) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}

// Hook pour changer d'organisation avec persistance
export function useSwitchOrganization() {
  const { switchOrganization, organizations } = useOrganizationStore();

  const handleSwitch = async (orgId: string) => {
    const org = organizations.find((o) => o.id === orgId);
    if (org) {
      switchOrganization(orgId);
      // Persister en base comme organisation par defaut
      try {
        await setDefaultOrganization(orgId);
      } catch (error) {
        console.error("Erreur lors de la persistance de l'organisation:", error);
      }
      // Recharger la page pour recuperer les nouvelles donnees
      window.location.reload();
    }
  };

  return handleSwitch;
}
