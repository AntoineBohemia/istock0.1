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

// Save the original then so we can restore it if a test overrides it
const originalThen = mockClient.then;

beforeEach(() => {
  vi.clearAllMocks();
  mockClient.then = originalThen;
  mockClient._setResult({ data: null, error: null });
});

// ─── inviteUserToOrganization ───────────────────────────────────────
describe("inviteUserToOrganization", () => {
  it("lowercases the email before inserting", async () => {
    mockClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockClient._setResults([
      { data: { id: "inv-1", email: "test@example.com", token: "tok-1" }, error: null },
      { data: { name: "My Org" }, error: null },
    ]);

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

    await expect(inviteUserToOrganization("org-1", "test@example.com")).rejects.toThrow(
      "Une invitation a déjà été envoyée à cet email"
    );
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

    await expect(inviteUserToOrganization("org-1", "test@example.com")).rejects.toThrow(
      "Table not found"
    );
  });

  it("sets invited_by from current user", async () => {
    mockClient.auth.getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-42" } },
      error: null,
    });
    mockClient._setResults([
      { data: { id: "inv-2", token: "tok-2" }, error: null },
      { data: { name: "Org" }, error: null },
    ]);

    await inviteUserToOrganization("org-1", "test@test.com", "admin");

    const insertCall = mockClient.insert.mock.calls[0][0];
    expect(insertCall.invited_by).toBe("user-42");
    expect(insertCall.role).toBe("admin");
  });
});

// ─── acceptInvitation (RPC-based) ───────────────────────────────────
describe("acceptInvitation", () => {
  it("throws when RPC returns error", async () => {
    mockClient._setResult({
      data: null,
      error: { message: "RPC error" },
    });

    await expect(acceptInvitation("token-1")).rejects.toThrow("Erreur lors de l'acceptation");
  });

  it("throws for expired invitation", async () => {
    mockClient._setResult({
      data: { success: false, error: "expired" },
      error: null,
    });

    await expect(acceptInvitation("bad-token")).rejects.toThrow("Cette invitation a expiré");
  });

  it("throws for invitation_not_found", async () => {
    mockClient._setResult({
      data: { success: false, error: "invitation_not_found" },
      error: null,
    });

    await expect(acceptInvitation("bad-token")).rejects.toThrow("Invitation invalide ou expirée");
  });

  it("throws when email does not match", async () => {
    mockClient._setResult({
      data: {
        success: false,
        error: "email_mismatch",
        expected_email: "original@test.com",
      },
      error: null,
    });

    await expect(acceptInvitation("token-1")).rejects.toThrow(
      "Cette invitation est destinée à original@test.com"
    );
  });

  it("successfully accepts invitation and returns organization", async () => {
    mockClient._setResult({
      data: {
        success: true,
        organization: {
          id: "org-1",
          name: "Test Org",
          slug: "test-org",
          logo_url: null,
        },
        role: "member",
      },
      error: null,
    });

    const result = await acceptInvitation("token-1");

    expect(mockClient.rpc).toHaveBeenCalledWith("accept_invitation_secure", {
      p_token: "token-1",
    });
    expect(result.organization.id).toBe("org-1");
    expect(result.organization.name).toBe("Test Org");
    expect(result.organization.role).toBe("member");
  });

  it("throws for already_member", async () => {
    mockClient._setResult({
      data: { success: false, error: "already_member" },
      error: null,
    });

    await expect(acceptInvitation("token-1")).rejects.toThrow(
      "Vous êtes déjà membre de cette organisation"
    );
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
    mockClient._setResults([
      { data: { role: "owner" }, error: null },
      { data: null, error: null },
    ]);

    await deleteOrganization("org-1");
    expect(mockClient.from).toHaveBeenCalled();
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
    mockClient._setResults([
      { data: { role: "owner" }, error: null },
      { data: null, error: { message: "Delete error" } },
    ]);

    await expect(deleteOrganization("org-1")).rejects.toThrow("Delete error");
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
    mockClient._setResults([
      { data: null, error: null },
      { data: null, error: null },
    ]);

    await setDefaultOrganization("org-2");

    expect(mockClient.update).toHaveBeenCalled();
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
    mockClient._setResults([
      { data: null, error: null },
      { data: null, error: { message: "Set default error" } },
    ]);

    await expect(setDefaultOrganization("org-1")).rejects.toThrow("Set default error");
  });
});

// ─── getOrganizationMembers ──────────────────────────────────────────
describe("getOrganizationMembers", () => {
  it("returns members list", async () => {
    const members = [
      {
        id: "m-1",
        user_id: "u-1",
        organization_id: "org-1",
        role: "owner",
        is_default: true,
        created_at: "2024-01-01",
      },
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
      {
        id: "inv-1",
        email: "a@b.com",
        role: "member",
        organization_id: "org-1",
        accepted_at: null,
        expires_at: "2099-01-01",
      },
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

// ─── getInvitationByToken (RPC-based) ────────────────────────────────
describe("getInvitationByToken", () => {
  it("returns invitation details when valid", async () => {
    mockClient._setResult({
      data: {
        valid: true,
        email: "a@b.com",
        masked_email: "a***@b.com",
        role: "member",
        expires_at: "2099-01-01",
        organization_name: "My Org",
        organization_logo_url: null,
        user_exists: false,
      },
      error: null,
    });

    const result = await getInvitationByToken("tok-1");

    expect(mockClient.rpc).toHaveBeenCalledWith("get_invitation_details", {
      p_token: "tok-1",
    });
    expect(result).not.toBeNull();
    expect(result!.organization_name).toBe("My Org");
    expect(result!.email).toBe("a@b.com");
  });

  it("returns null on error", async () => {
    mockClient._setResult({ data: null, error: { message: "Not found" } });

    const result = await getInvitationByToken("bad-token");

    expect(result).toBeNull();
  });

  it("returns null when data is not valid", async () => {
    mockClient._setResult({ data: { valid: false }, error: null });

    const result = await getInvitationByToken("expired-token");

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
