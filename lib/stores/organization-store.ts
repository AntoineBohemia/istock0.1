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

// Note : un cookie reflet de la societe courante a existe ici, pour permettre
// aux pages rendues cote serveur de connaitre la selection. Il a ete retire.
// Le serveur rend la page avant que le navigateur n'ecrive le cookie : au
// premier affichage la valeur etait absente, et le chiffre affiche faux
// jusqu'a une navigation. Un chiffre parfois juste est pire qu'un chiffre
// franchement global.
//
// Les ecrans qui doivent connaitre la societe la lisent depuis ce store, cote
// client. Les pages serveur affichent des totaux, annonces comme tels.
export const useOrganizationStore = create<OrganizationStore>()(
  persist(organizationStore, {
    name: "organization-storage",
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
      currentOrganization: state.currentOrganization,
    }),
  })
);

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
