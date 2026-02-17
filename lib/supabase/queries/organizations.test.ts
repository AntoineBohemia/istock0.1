import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/lib/__mocks__/supabase";

const mockClient = createMockSupabaseClient();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

import { inviteUserToOrganization, acceptInvitation } from "./organizations";

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
