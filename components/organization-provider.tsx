"use client";

import { useEffect } from "react";
import { useOrganizationStore, Organization } from "@/lib/stores/organization-store";
import {
  getUserOrganizations,
  getDefaultOrganization,
  setDefaultOrganization,
} from "@/lib/supabase/queries/organizations";
import { createClient } from "@/lib/supabase/client";

interface OrganizationProviderProps {
  children: React.ReactNode;
}

export default function OrganizationProvider({
  children,
}: OrganizationProviderProps) {
  const {
    currentOrganization,
    setCurrentOrganization,
    setOrganizations,
    setIsLoading,
  } = useOrganizationStore();

  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setIsLoading(false);
          return;
        }

        // Charger toutes les organisations
        const orgs = await getUserOrganizations();
        setOrganizations(orgs);

        // Si pas d'organisation courante, prendre la par défaut ou la première
        if (!currentOrganization && orgs.length > 0) {
          const defaultOrg = await getDefaultOrganization();
          setCurrentOrganization(defaultOrg || orgs[0]);
        } else if (currentOrganization) {
          // Vérifier que l'organisation courante est toujours valide
          const stillValid = orgs.find((o) => o.id === currentOrganization.id);
          if (!stillValid && orgs.length > 0) {
            setCurrentOrganization(orgs[0]);
          }
        }
      } catch (error) {
        console.error("Erreur lors du chargement des organisations:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadOrganizations();

    // Écouter les changements d'authentification
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
  }, []);

  return <>{children}</>;
}

// Hook pour changer d'organisation avec persistance
export function useSwitchOrganization() {
  const { switchOrganization, organizations } = useOrganizationStore();

  const handleSwitch = async (orgId: string) => {
    const org = organizations.find((o) => o.id === orgId);
    if (org) {
      switchOrganization(orgId);
      // Persister en base comme organisation par défaut
      try {
        await setDefaultOrganization(orgId);
      } catch (error) {
        console.error("Erreur lors de la persistance de l'organisation:", error);
      }
      // Recharger la page pour récupérer les nouvelles données
      window.location.reload();
    }
  };

  return handleSwitch;
}
