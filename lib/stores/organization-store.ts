import { create, StateCreator } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  role: "owner" | "admin" | "member";
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

const organizationStore: StateCreator<
  OrganizationStore,
  [],
  [["zustand/persist", unknown]]
> = (set, get) => ({
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

export const useOrganizationStore = create<OrganizationStore>()(
  persist(organizationStore, {
    name: "organization-storage",
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
      currentOrganization: state.currentOrganization,
    }),
  })
);

// Helper pour vérifier les permissions
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
