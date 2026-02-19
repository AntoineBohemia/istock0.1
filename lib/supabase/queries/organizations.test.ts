import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/lib/__mocks__/supabase";

const mockClient = createMockSupabaseClient();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

import {
  inviteUserToOrganization,
  acceptInvitation,
  getUserOrganizations,
  getDefaultOrganization,
  setDefaultOrganization,
  getOrganizationMembers,
  updateMemberRole,
  removeMember,
  getPendingInvitations,
  cancelInvitation,
  getInvitationByToken,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  getAllOrganizations,
} from "./organizations";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── inviteUserToOrganization ───────────────────────────────────────
describe("inviteUserToOrganization", () => {
  it("lowercases the email before inserting", async () => {
    mockClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockClient._setResult({
      data: { id: "inv-1", email: "test@example.com" },
      error: null,
    });

    await inviteUserToOrganization("org-1", "Test@Example.COM");

    const insertCall = mockClient.insert.mock.calls[0][0];
    expect(insertCall.email).toBe("test@example.com");
  });

  it("throws specific message for duplicate invitation (error code 23505)", async () => {
    mockClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockClient._setResult({
      data: null,
      error: { code: "23505", message: "duplicate" },
    });

    await expect(
      inviteUserToOrganization("org-1", "test@example.com")
    ).rejects.toThrow("Une invitation a déjà été envoyée à cet email");
  });

  it("throws generic error for other failures", async () => {
    mockClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockClient._setResult({
      data: null,
      error: { code: "42P01", message: "Table not found" },
    });

    await expect(
      inviteUserToOrganization("org-1", "test@example.com")
    ).rejects.toThrow("Table not found");
  });

  it("sets invited_by from current user", async () => {
    mockClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-42" } },
      error: null,
    });
    mockClient._setResult({ data: { id: "inv-2" }, error: null });

    await inviteUserToOrganization("org-1", "test@test.com", "admin");

    const insertCall = mockClient.insert.mock.calls[0][0];
    expect(insertCall.invited_by).toBe("user-42");
    expect(insertCall.role).toBe("admin");
  });
});

// ─── acceptInvitation ───────────────────────────────────────────────
describe("acceptInvitation", () => {
  it("throws when user is not authenticated", async () => {
    mockClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(acceptInvitation("token-1")).rejects.toThrow(
      "Vous devez être connecté"
    );
  });

  it("throws for expired/invalid invitation", async () => {
    mockClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1", email: "test@test.com" } },
      error: null,
    });
    mockClient._setResult({
      data: null,
      error: { message: "No rows found" },
    });

    await expect(acceptInvitation("bad-token")).rejects.toThrow(
      "Invitation invalide ou expirée"
    );
  });

  it("throws when email does not match", async () => {
    mockClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1", email: "other@test.com" } },
      error: null,
    });

    let callCount = 0;
    const originalThen = mockClient.then;
    mockClient.then = (resolve: any, reject?: any) => {
      callCount++;
      if (callCount === 1) {
        // Fetch invitation
        return Promise.resolve({
          data: {
            id: "inv-1",
            email: "original@test.com",
            role: "member",
            organization_id: "org-1",
            organization: { id: "org-1", name: "Test", slug: "test", logo_url: null },
          },
          error: null,
        }).then(resolve, reject);
      }
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    };

    await expect(acceptInvitation("token-1")).rejects.toThrow(
      "Cette invitation est destinée à une autre adresse email"
    );

    mockClient.then = originalThen;
  });

  it("successfully accepts invitation and returns organization", async () => {
    mockClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1", email: "test@test.com" } },
      error: null,
    });

    let callCount = 0;
    const originalThen = mockClient.then;
    mockClient.then = (resolve: any, reject?: any) => {
      callCount++;
      if (callCount === 1) {
        // Fetch invitation
        return Promise.resolve({
          data: {
            id: "inv-1",
            email: "test@test.com",
            role: "member",
            organization_id: "org-1",
            organization: { id: "org-1", name: "Test Org", slug: "test-org", logo_url: null },
          },
          error: null,
        }).then(resolve, reject);
      }
      // Join org + mark accepted
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    };

    const result = await acceptInvitation("token-1");
    expect(result.organization.id).toBe("org-1");
    expect(result.organization.name).toBe("Test Org");
    expect(result.organization.role).toBe("member");

    mockClient.then = originalThen;
  });

  it("handles duplicate membership (23505) gracefully", async () => {
    mockClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1", email: "test@test.com" } },
      error: null,
    });

    let callCount = 0;
    const originalThen = mockClient.then;
    mockClient.then = (resolve: any, reject?: any) => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          data: {
            id: "inv-1",
            email: "test@test.com",
            role: "member",
            organization_id: "org-1",
            organization: { id: "org-1", name: "Test", slug: "test", logo_url: null },
          },
          error: null,
        }).then(resolve, reject);
      }
      if (callCount === 2) {
        // Join fails with duplicate
        return Promise.resolve({
          data: null,
          error: { code: "23505", message: "duplicate" },
        }).then(resolve, reject);
      }
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    };

    await expect(acceptInvitation("token-1")).rejects.toThrow(
      "Vous êtes déjà membre de cette organisation"
    );

    mockClient.then = originalThen;
  });
});

// ─── createOrganization ──────────────────────────────────────────────
describe("createOrganization", () => {
  it("calls RPC create_organization_with_owner and returns organization", async () => {
    const rpcResult = { id: "org-1", name: "My Org", slug: "my-org", logo_url: null };
    mockClient._setResult({ data: rpcResult, error: null });

    const result = await createOrganization("My Org", "my-org");

    expect(mockClient.rpc).toHaveBeenCalledWith("create_organization_with_owner", {
      org_name: "My Org",
      org_slug: "my-org",
      org_logo_url: undefined,
    });
    expect(result).toEqual({
      id: "org-1",
      name: "My Org",
      slug: "my-org",
      logo_url: null,
      role: "owner",
    });
  });

  it("throws specific error for duplicate slug (23505)", async () => {
    mockClient._setResult({ data: null, error: { code: "23505", message: "duplicate" } });

    await expect(createOrganization("Org", "existing-slug")).rejects.toThrow(
      "Ce slug est déjà utilisé"
    );
  });

  it("throws generic error", async () => {
    mockClient._setResult({ data: null, error: { code: "42P01", message: "RPC failed" } });

    await expect(createOrganization("Org", "slug")).rejects.toThrow("RPC failed");
  });
});

// ─── updateOrganization ──────────────────────────────────────────────
describe("updateOrganization", () => {
  it("updates provided fields", async () => {
    mockClient._setResult({ data: null, error: null });

    await updateOrganization("org-1", { name: "New Name" });

    expect(mockClient.update).toHaveBeenCalledWith({ name: "New Name" });
    expect(mockClient.eq).toHaveBeenCalledWith("id", "org-1");
  });

  it("sanitizes slug to lowercase with only allowed chars", async () => {
    mockClient._setResult({ data: null, error: null });

    await updateOrganization("org-1", { slug: "My Org!@#" });

    expect(mockClient.update).toHaveBeenCalledWith({ slug: "my-org---" });
  });

  it("throws for duplicate slug (23505)", async () => {
    mockClient._setResult({ data: null, error: { code: "23505", message: "duplicate" } });

    await expect(updateOrganization("org-1", { slug: "taken" })).rejects.toThrow(
      "Ce slug est déjà utilisé"
    );
  });

  it("throws generic error", async () => {
    mockClient._setResult({ data: null, error: { code: "42P01", message: "Update error" } });

    await expect(updateOrganization("org-1", { name: "X" })).rejects.toThrow("Update error");
  });
});

// ─── deleteOrganization ──────────────────────────────────────────────
describe("deleteOrganization", () => {
  it("deletes org when user is owner", async () => {
    mockClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    let callCount = 0;
    const originalThen = mockClient.then;

    mockClient.then = (resolve: any, reject?: any) => {
      callCount++;
      if (callCount === 1) {
        // Membership check
        return Promise.resolve({ data: { role: "owner" }, error: null }).then(resolve, reject);
      }
      // Delete org
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    };

    await deleteOrganization("org-1");
    expect(mockClient.from).toHaveBeenCalled();

    mockClient.then = originalThen;
  });

  it("throws when user is not authenticated", async () => {
    mockClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(deleteOrganization("org-1")).rejects.toThrow("Utilisateur non connecté");
  });

  it("throws when user is not owner", async () => {
    mockClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockClient._setResult({ data: { role: "member" }, error: null });

    await expect(deleteOrganization("org-1")).rejects.toThrow(
      "Seul le propriétaire peut supprimer"
    );
  });

  it("throws on Supabase error", async () => {
    mockClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    let callCount = 0;
    const originalThen = mockClient.then;

    mockClient.then = (resolve: any, reject?: any) => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ data: { role: "owner" }, error: null }).then(resolve, reject);
      }
      return Promise.resolve({ data: null, error: { message: "Delete error" } }).then(resolve, reject);
    };

    await expect(deleteOrganization("org-1")).rejects.toThrow("Delete error");

    mockClient.then = originalThen;
  });
});

// ─── getUserOrganizations ────────────────────────────────────────────
describe("getUserOrganizations", () => {
  it("returns mapped organizations for authenticated user", async () => {
    mockClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockClient._setResult({
      data: [
        {
          role: "owner",
          is_default: true,
          organization: { id: "org-1", name: "My Org", slug: "my-org", logo_url: null },
        },
      ],
      error: null,
    });

    const result = await getUserOrganizations();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "org-1",
      name: "My Org",
      slug: "my-org",
      logo_url: null,
      role: "owner",
    });
  });

  it("returns empty array when not authenticated", async () => {
    mockClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await getUserOrganizations();

    expect(result).toEqual([]);
  });

  it("throws on Supabase error", async () => {
    mockClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockClient._setResult({ data: null, error: { message: "Query error" } });

    await expect(getUserOrganizations()).rejects.toThrow("Query error");
  });
});

// ─── getDefaultOrganization ──────────────────────────────────────────
describe("getDefaultOrganization", () => {
  it("returns default org", async () => {
    mockClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockClient._setResult({
      data: {
        role: "owner",
        organization: { id: "org-1", name: "Default Org", slug: "default", logo_url: null },
      },
      error: null,
    });

    const result = await getDefaultOrganization();

    expect(result).toEqual({
      id: "org-1",
      name: "Default Org",
      slug: "default",
      logo_url: null,
      role: "owner",
    });
  });

  it("returns null when not authenticated", async () => {
    mockClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await getDefaultOrganization();

    expect(result).toBeNull();
  });
});

// ─── setDefaultOrganization ──────────────────────────────────────────
describe("setDefaultOrganization", () => {
  it("resets all defaults then sets new one", async () => {
    mockClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    let callCount = 0;
    const originalThen = mockClient.then;

    mockClient.then = (resolve: any, reject?: any) => {
      callCount++;
      if (callCount === 1) {
        // Reset all defaults
        return Promise.resolve({ data: null, error: null }).then(resolve, reject);
      }
      // Set new default
      return Promise.resolve({ data: null, error: null }).then(resolve, reject);
    };

    await setDefaultOrganization("org-2");

    expect(mockClient.update).toHaveBeenCalled();

    mockClient.then = originalThen;
  });

  it("throws when not authenticated", async () => {
    mockClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(setDefaultOrganization("org-1")).rejects.toThrow("Utilisateur non connecté");
  });

  it("throws on Supabase error", async () => {
    mockClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    let callCount = 0;
    const originalThen = mockClient.then;

    mockClient.then = (resolve: any, reject?: any) => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ data: null, error: null }).then(resolve, reject);
      }
      return Promise.resolve({ data: null, error: { message: "Set default error" } }).then(resolve, reject);
    };

    await expect(setDefaultOrganization("org-1")).rejects.toThrow("Set default error");

    mockClient.then = originalThen;
  });
});

// ─── getOrganizationMembers ──────────────────────────────────────────
describe("getOrganizationMembers", () => {
  it("returns members list", async () => {
    const members = [
      { id: "m-1", user_id: "u-1", organization_id: "org-1", role: "owner", is_default: true, created_at: "2024-01-01" },
    ];
    mockClient._setResult({ data: members, error: null });

    const result = await getOrganizationMembers("org-1");

    expect(result).toEqual(members);
    expect(mockClient.eq).toHaveBeenCalledWith("organization_id", "org-1");
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Members error" } });

    await expect(getOrganizationMembers("org-1")).rejects.toThrow("Members error");
  });
});

// ─── updateMemberRole ────────────────────────────────────────────────
describe("updateMemberRole", () => {
  it("updates role for given user/org", async () => {
    mockClient._setResult({ data: null, error: null });

    await updateMemberRole("org-1", "user-1", "admin");

    expect(mockClient.update).toHaveBeenCalledWith({ role: "admin" });
    expect(mockClient.eq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(mockClient.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Role error" } });

    await expect(updateMemberRole("org-1", "user-1", "admin")).rejects.toThrow("Role error");
  });
});

// ─── removeMember ────────────────────────────────────────────────────
describe("removeMember", () => {
  it("deletes membership", async () => {
    mockClient._setResult({ data: null, error: null });

    await removeMember("org-1", "user-1");

    expect(mockClient.delete).toHaveBeenCalled();
    expect(mockClient.eq).toHaveBeenCalledWith("organization_id", "org-1");
    expect(mockClient.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Remove error" } });

    await expect(removeMember("org-1", "user-1")).rejects.toThrow("Remove error");
  });
});

// ─── getPendingInvitations ───────────────────────────────────────────
describe("getPendingInvitations", () => {
  it("returns non-expired, non-accepted invitations", async () => {
    const invitations = [
      { id: "inv-1", email: "a@b.com", role: "member", organization_id: "org-1", accepted_at: null, expires_at: "2099-01-01" },
    ];
    mockClient._setResult({ data: invitations, error: null });

    const result = await getPendingInvitations("org-1");

    expect(result).toEqual(invitations);
    expect(mockClient.is).toHaveBeenCalledWith("accepted_at", null);
    expect(mockClient.gt).toHaveBeenCalled();
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Invitations error" } });

    await expect(getPendingInvitations("org-1")).rejects.toThrow("Invitations error");
  });
});

// ─── cancelInvitation ────────────────────────────────────────────────
describe("cancelInvitation", () => {
  it("deletes invitation by id", async () => {
    mockClient._setResult({ data: null, error: null });

    await cancelInvitation("inv-1");

    expect(mockClient.delete).toHaveBeenCalled();
    expect(mockClient.eq).toHaveBeenCalledWith("id", "inv-1");
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Cancel error" } });

    await expect(cancelInvitation("inv-1")).rejects.toThrow("Cancel error");
  });
});

// ─── getInvitationByToken ────────────────────────────────────────────
describe("getInvitationByToken", () => {
  it("returns invitation with org name", async () => {
    mockClient._setResult({
      data: {
        id: "inv-1",
        email: "a@b.com",
        token: "tok-1",
        role: "member",
        organization_id: "org-1",
        organization: { name: "My Org" },
        invited_by: null,
        expires_at: "2099-01-01",
        accepted_at: null,
        created_at: "2024-01-01",
      },
      error: null,
    });

    const result = await getInvitationByToken("tok-1");

    expect(result).not.toBeNull();
    expect(result!.organization.name).toBe("My Org");
  });

  it("returns null on error", async () => {
    mockClient._setResult({ data: null, error: { message: "Not found" } });

    const result = await getInvitationByToken("bad-token");

    expect(result).toBeNull();
  });
});

// ─── getAllOrganizations ─────────────────────────────────────────────
describe("getAllOrganizations", () => {
  it("returns orgs with member count", async () => {
    mockClient._setResult({
      data: [
        {
          id: "org-1",
          name: "Org 1",
          slug: "org-1",
          logo_url: null,
          user_organizations: [{ count: 5 }],
        },
      ],
      error: null,
    });

    const result = await getAllOrganizations();

    expect(result).toHaveLength(1);
    expect(result[0].memberCount).toBe(5);
    expect(result[0].name).toBe("Org 1");
  });

  it("throws on Supabase error", async () => {
    mockClient._setResult({ data: null, error: { message: "Fetch error" } });

    await expect(getAllOrganizations()).rejects.toThrow("Fetch error");
  });
});
