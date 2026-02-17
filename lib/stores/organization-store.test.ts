import { describe, it, expect, beforeEach } from "vitest";
import {
  useOrganizationStore,
  canInvite,
  canManageMembers,
  canDeleteOrganization,
  canManageAdmins,
  type Organization,
} from "./organization-store";

const mockOrg: Organization = {
  id: "org-1",
  name: "Test Org",
  slug: "test-org",
  logo_url: null,
  role: "owner",
};

const mockOrg2: Organization = {
  id: "org-2",
  name: "Other Org",
  slug: "other-org",
  logo_url: "https://example.com/logo.png",
  role: "member",
};

// ─── Permission helpers ─────────────────────────────────────────────
describe("canInvite", () => {
  it("returns true for owner", () => {
    expect(canInvite("owner")).toBe(true);
  });

  it("returns true for admin", () => {
    expect(canInvite("admin")).toBe(true);
  });

  it("returns false for member", () => {
    expect(canInvite("member")).toBe(false);
  });
});

describe("canManageMembers", () => {
  it("returns true for owner", () => {
    expect(canManageMembers("owner")).toBe(true);
  });

  it("returns false for member", () => {
    expect(canManageMembers("member")).toBe(false);
  });
});

describe("canDeleteOrganization", () => {
  it("returns true only for owner", () => {
    expect(canDeleteOrganization("owner")).toBe(true);
    expect(canDeleteOrganization("admin")).toBe(false);
    expect(canDeleteOrganization("member")).toBe(false);
  });
});

describe("canManageAdmins", () => {
  it("returns true only for owner", () => {
    expect(canManageAdmins("owner")).toBe(true);
    expect(canManageAdmins("admin")).toBe(false);
  });
});

// ─── Zustand store ──────────────────────────────────────────────────
describe("useOrganizationStore", () => {
  beforeEach(() => {
    useOrganizationStore.getState().reset();
    localStorage.clear();
  });

  it("starts with null currentOrganization", () => {
    expect(useOrganizationStore.getState().currentOrganization).toBeNull();
  });

  it("setCurrentOrganization updates the store", () => {
    useOrganizationStore.getState().setCurrentOrganization(mockOrg);
    expect(useOrganizationStore.getState().currentOrganization).toEqual(mockOrg);
  });

  it("setOrganizations stores the list", () => {
    useOrganizationStore.getState().setOrganizations([mockOrg, mockOrg2]);
    expect(useOrganizationStore.getState().organizations).toHaveLength(2);
  });

  it("switchOrganization sets current from list", () => {
    useOrganizationStore.getState().setOrganizations([mockOrg, mockOrg2]);
    useOrganizationStore.getState().switchOrganization("org-2");
    expect(useOrganizationStore.getState().currentOrganization?.id).toBe("org-2");
  });

  it("switchOrganization does nothing for unknown id", () => {
    useOrganizationStore.getState().setOrganizations([mockOrg]);
    useOrganizationStore.getState().setCurrentOrganization(mockOrg);
    useOrganizationStore.getState().switchOrganization("unknown");
    expect(useOrganizationStore.getState().currentOrganization?.id).toBe("org-1");
  });

  it("reset clears all state", () => {
    useOrganizationStore.getState().setOrganizations([mockOrg]);
    useOrganizationStore.getState().setCurrentOrganization(mockOrg);
    useOrganizationStore.getState().setIsLoading(false);
    useOrganizationStore.getState().reset();

    const state = useOrganizationStore.getState();
    expect(state.currentOrganization).toBeNull();
    expect(state.organizations).toHaveLength(0);
    expect(state.isLoading).toBe(true);
  });

  it("persists currentOrganization to localStorage", () => {
    useOrganizationStore.getState().setCurrentOrganization(mockOrg);
    // Zustand persist writes to localStorage
    const stored = localStorage.getItem("organization-storage");
    expect(stored).toBeTruthy();
    if (stored) {
      const parsed = JSON.parse(stored);
      expect(parsed.state.currentOrganization.id).toBe("org-1");
    }
  });
});
