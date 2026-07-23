"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useOrganizationStore } from "@/lib/stores/organization-store";
import {
  getUserOrganizations,
  getDefaultOrganization,
  setDefaultOrganization,
  getMyPendingInvitations,
} from "@/lib/supabase/queries/organizations";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

interface OrganizationProviderProps {
  children: React.ReactNode;
}

// Routes qui ne necessitent pas d'organisation
const ONBOARDING_ROUTES = ["/onboarding-flow", "/invite"];

export default function OrganizationProvider({ children }: OrganizationProviderProps) {
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const { setCurrentOrganization, setOrganizations, setIsLoading } = useOrganizationStore();

  // Verifier si on est sur une route d'onboarding
  const isOnboardingRoute = ONBOARDING_ROUTES.some((route) => pathname.startsWith(route));

  useEffect(() => {
    let cancelled = false;

    const loadOrganizations = async () => {
      setIsChecking(true);

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (!user) {
          setIsLoading(false);
          setIsChecking(false);
          return;
        }

        // Charger toutes les organisations
        const orgs = await getUserOrganizations();
        if (cancelled) return;

        setOrganizations(orgs);

        // Aucune organisation : deux cas tres differents.
        //
        // - On a ete invite : une invitation attend d'etre acceptee. On y va,
        //   pas dans l'onboarding « creez votre organisation » — un collegue
        //   rejoint une equipe existante, il ne fonde rien. C'est le cas normal
        //   d'un usage interne.
        // - Personne ne nous a invite : la seule facon d'avoir un espace est
        //   d'en creer un, donc l'onboarding.
        if (orgs.length === 0 && !isOnboardingRoute) {
          const invitations = await getMyPendingInvitations();
          if (cancelled) return;
          // On envoie sur la page d'acceptation de l'invitation elle-meme
          // (/invite/[token]) : elle ne demande pas d'organisation — c'est
          // justement la ou l'on en gagne une — et evite la boucle qu'aurait
          // provoquee une page protegee. A defaut, l'onboarding.
          const token = (invitations[0] as { token?: string } | undefined)?.token;
          window.location.href = token ? `/invite/${token}` : "/onboarding-flow";
          return;
        }

        // Read current store state inside the effect to avoid stale closure
        const currentOrg = useOrganizationStore.getState().currentOrganization;

        // Si pas d'organisation courante, prendre la par defaut ou la premiere
        if (!currentOrg && orgs.length > 0) {
          const defaultOrg = await getDefaultOrganization();
          if (cancelled) return;
          setCurrentOrganization(defaultOrg || orgs[0]);
        } else if (currentOrg) {
          // Verifier que l'organisation courante est toujours valide
          const stillValid = orgs.find((o) => o.id === currentOrg.id);
          if (!stillValid && orgs.length > 0) {
            setCurrentOrganization(orgs[0]);
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Erreur lors du chargement des organisations:", error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsChecking(false);
        }
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
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [pathname, isOnboardingRoute, setCurrentOrganization, setOrganizations, setIsLoading]);

  // Afficher un loader pendant la verification (sauf sur les routes d'onboarding)
  if (isChecking && !isOnboardingRoute) {
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
  const queryClient = useQueryClient();

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
      // Invalidate all cached queries — data stays visible during refetch
      queryClient.invalidateQueries();
    }
  };

  return handleSwitch;
}
