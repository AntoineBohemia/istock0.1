import { describe, it, expect } from "vitest";
import { shouldBlockGuestRoute } from "./guest-route-guard";

describe("shouldBlockGuestRoute", () => {
  describe("for guest role", () => {
    it("blocks /global exactly", () => {
      expect(shouldBlockGuestRoute("guest", "/global")).toBe(true);
    });

    it("blocks /global/anything", () => {
      expect(shouldBlockGuestRoute("guest", "/global/stats")).toBe(true);
    });

    it("blocks /settings exactly", () => {
      expect(shouldBlockGuestRoute("guest", "/settings")).toBe(true);
    });

    it("blocks /settings/members", () => {
      expect(shouldBlockGuestRoute("guest", "/settings/members")).toBe(true);
    });

    it("blocks /settings/organizations", () => {
      expect(shouldBlockGuestRoute("guest", "/settings/organizations")).toBe(true);
    });

    it("blocks /settings/categories", () => {
      expect(shouldBlockGuestRoute("guest", "/settings/categories")).toBe(true);
    });

    it("does NOT block /users", () => {
      expect(shouldBlockGuestRoute("guest", "/users")).toBe(false);
    });

    it("does NOT block /product", () => {
      expect(shouldBlockGuestRoute("guest", "/product")).toBe(false);
    });

    it("does NOT block /stock", () => {
      expect(shouldBlockGuestRoute("guest", "/stock")).toBe(false);
    });

    it("does NOT block /orders", () => {
      expect(shouldBlockGuestRoute("guest", "/orders")).toBe(false);
    });

    it("does NOT block a URL that merely contains /global as substring", () => {
      expect(shouldBlockGuestRoute("guest", "/globalization")).toBe(false);
    });
  });

  describe("for non-guest roles", () => {
    it.each(["owner", "admin", "member"])(
      "never blocks %s on any path",
      (role) => {
        expect(shouldBlockGuestRoute(role, "/global")).toBe(false);
        expect(shouldBlockGuestRoute(role, "/settings")).toBe(false);
        expect(shouldBlockGuestRoute(role, "/settings/members")).toBe(false);
        expect(shouldBlockGuestRoute(role, "/users")).toBe(false);
      }
    );
  });

  describe("for undefined role", () => {
    it("does not block (user not yet loaded)", () => {
      expect(shouldBlockGuestRoute(undefined, "/global")).toBe(false);
      expect(shouldBlockGuestRoute(undefined, "/settings")).toBe(false);
    });
  });
});
