import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @supabase/ssr
let mockGetUser: ReturnType<typeof vi.fn>;

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

// Mock next/server
const mockRedirect = vi.fn();
const mockNextResponse = vi.fn();

vi.mock("next/server", () => {
  const createMockResponse = (props: any = {}) => ({
    cookies: {
      set: vi.fn(),
      delete: vi.fn(),
    },
    ...props,
  });

  return {
    NextResponse: {
      redirect: (url: URL) => {
        const resp = createMockResponse({ redirectUrl: url.toString() });
        mockRedirect(url);
        return resp;
      },
      next: (opts: any) => {
        const resp = createMockResponse({ type: "next" });
        mockNextResponse(opts);
        return resp;
      },
    },
  };
});

import { proxy } from "./proxy";

function createCloneableURL(pathname: string, searchParams: Record<string, string> = {}) {
  const url = new URL(`http://localhost:3000${pathname}`);
  for (const [k, v] of Object.entries(searchParams)) {
    url.searchParams.set(k, v);
  }
  // Next.js URL has a clone() method
  (url as any).clone = () => createCloneableURL(pathname, searchParams);
  return url;
}

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function createMockRequest(
  pathname: string,
  searchParams: Record<string, string> = {},
  userAgent: string = DESKTOP_UA
) {
  const url = createCloneableURL(pathname, searchParams);

  return {
    url: url.toString(),
    nextUrl: url,
    headers: new Headers({ "user-agent": userAgent }),
    cookies: {
      getAll: () => [],
      set: vi.fn(),
    },
  } as any;
}

describe("proxy middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    });
  });

  // ─── Code redirect ──────────────────────────────────────────────
  it("redirects root with ?code to /auth/callback", async () => {
    const req = createMockRequest("/", { code: "abc123" });
    const result = await proxy(req);

    expect(mockRedirect).toHaveBeenCalled();
    const redirectUrl = mockRedirect.mock.calls[0][0] as URL;
    expect(redirectUrl.pathname).toBe("/auth/callback");
    expect(redirectUrl.searchParams.get("code")).toBe("abc123");
  });

  it("includes ?next param in callback redirect when present", async () => {
    const req = createMockRequest("/", { code: "abc123", next: "/parametres" });
    await proxy(req);

    const redirectUrl = mockRedirect.mock.calls[0][0] as URL;
    expect(redirectUrl.searchParams.get("next")).toBe("/parametres");
  });

  // ─── Auth routes ────────────────────────────────────────────────
  it("redirects authenticated user on /login to the default route", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    const req = createMockRequest("/login");
    await proxy(req);

    expect(mockRedirect).toHaveBeenCalled();
    const redirectUrl = mockRedirect.mock.calls[0][0] as URL;
    expect(redirectUrl.pathname).toBe("/produits");
  });

  it("redirects an authenticated mobile user on /login to /actions", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    const req = createMockRequest("/login", {}, MOBILE_UA);
    await proxy(req);

    const redirectUrl = mockRedirect.mock.calls[0][0] as URL;
    expect(redirectUrl.pathname).toBe("/actions");
  });

  it("redirects an authenticated mobile user on / to /actions", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    const req = createMockRequest("/", {}, MOBILE_UA);
    await proxy(req);

    const redirectUrl = mockRedirect.mock.calls[0][0] as URL;
    expect(redirectUrl.pathname).toBe("/actions");
  });

  it("redirects authenticated user on / to the default route", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    const req = createMockRequest("/");
    await proxy(req);

    expect(mockRedirect).toHaveBeenCalled();
  });

  // ─── Protected routes ───────────────────────────────────────────
  it("redirects unauthenticated user on /global to /login with redirectTo", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const req = createMockRequest("/actions");
    await proxy(req);

    expect(mockRedirect).toHaveBeenCalled();
    const redirectUrl = mockRedirect.mock.calls[0][0] as URL;
    expect(redirectUrl.pathname).toBe("/login");
    expect(redirectUrl.searchParams.get("redirectTo")).toBe("/actions");
  });

  it("redirects unauthenticated user on /settings/profile to /login", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const req = createMockRequest("/parametres/profile");
    await proxy(req);

    expect(mockRedirect).toHaveBeenCalled();
    const redirectUrl = mockRedirect.mock.calls[0][0] as URL;
    expect(redirectUrl.pathname).toBe("/login");
  });

  // ─── Refresh token error ────────────────────────────────────────
  it("clears cookies and redirects to login on refresh_token_not_found", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { code: "refresh_token_not_found" },
    });

    const req = createMockRequest("/actions");
    const result = await proxy(req);

    expect(mockRedirect).toHaveBeenCalled();
    expect(result.cookies.delete).toHaveBeenCalled();
  });

  // ─── Pass-through ───────────────────────────────────────────────
  it("passes through for non-auth, non-protected routes without user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const req = createMockRequest("/about");
    const result = await proxy(req);

    // Should not redirect
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result.type).toBe("next");
  });

  it("passes through for authenticated user on protected route", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    const req = createMockRequest("/actions");
    const result = await proxy(req);

    // No redirect, user is allowed
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
