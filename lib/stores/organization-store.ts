import { create, StateCreator } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Role = "owner" | "admin" | "member";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  role: Role;
}

interface OrganizationStore {
  currentOrganization: Organization | null;
  organizations: Organization[];
  isLoading: boolean;
  setCurrentOrganization: (org: Organization) => void;
  setOrganizations: (orgs: Organization[]) => void;
  setIsLoading: (loading: boolean) => void;
  switchOrganization: (orgId: string) => void;
  reset: () => void;
}

const organizationStore: StateCreator<OrganizationStore, [], [["zustand/persist", unknown]]> = (
  set,
  get
) => ({
  currentOrganization: null,
  organizations: [],
  isLoading: true,
  setCurrentOrganization: (org) => set({ currentOrganization: org }),
  setOrganizations: (orgs) => set({ organizations: orgs }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  switchOrganization: (orgId) => {
    const org = get().organizations.find((o) => o.id === orgId);
    if (org) {
      set({ currentOrganization: org });
    }
  },
  reset: () =>
    set({
      currentOrganization: null,
      organizations: [],
      isLoading: true,
    }),
});

/**
 * Nom du cookie qui reflete la societe courante.
 *
 * Le store vit dans localStorage, que le serveur ne voit pas : les pages
 * rendues cote serveur — la fiche produit, par exemple — ignoraient donc
 * completement quelle societe etait selectionnee et affichaient le stock
 * toutes societes confondues. Ce cookie leur donne la reponse.
 *
 * Volontairement lisible par le navigateur (pas httpOnly) : c'est le client
 * qui l'ecrit, et il ne contient qu'un identifiant de societe deja connu de
 * l'utilisateur. Les droits restent appliques par la RLS, jamais par ce
 * cookie.
 */
export const CURRENT_ORG_COOKIE = "istock-current-org";

function syncOrgCookie(orgId: string | null) {
  if (typeof document === "undefined") return;
  const base = `${CURRENT_ORG_COOKIE}=${orgId ?? ""}; path=/; SameSite=Lax`;
  document.cookie = orgId ? `${base}; max-age=${60 * 60 * 24 * 365}` : `${base}; max-age=0`;
}

export const useOrganizationStore = create<OrganizationStore>()(
  persist(organizationStore, {
    name: "organization-storage",
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
      currentOrganization: state.currentOrganization,
    }),
    // Au retour sur le site, le cookie peut avoir expire alors que
    // localStorage a survecu : on le reecrit depuis l'etat restaure.
    onRehydrateStorage: () => (state) => {
      syncOrgCookie(state?.currentOrganization?.id ?? null);
    },
  })
);

// Toute ecriture de la societe courante met le cookie a jour. S'abonner au
// store plutot que modifier chaque appelant : un nouveau point de changement
// serait sinon oublie, et le serveur repartirait sur une societe perimee.
useOrganizationStore.subscribe((state) => {
  syncOrgCookie(state.currentOrganization?.id ?? null);
});

// Helpers de permissions
export function canInvite(role: string): boolean {
  return role === "owner" || role === "admin";
}

export function canManageMembers(role: string): boolean {
  return role === "owner" || role === "admin";
}

export function canDeleteOrganization(role: string): boolean {
  return role === "owner";
}

export function canManageAdmins(role: string): boolean {
  return role === "owner";
}

// Selective hooks to avoid unnecessary re-renders
export const useCurrentOrganization = () => useOrganizationStore((s) => s.currentOrganization);

export const useCurrentOrgId = () => useOrganizationStore((s) => s.currentOrganization?.id);

export const useCurrentOrgRole = () => useOrganizationStore((s) => s.currentOrganization?.role);

export const useOrgIsLoading = () => useOrganizationStore((s) => s.isLoading);
