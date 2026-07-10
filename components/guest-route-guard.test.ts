import { describe, it, expect } from "vitest";
import { shouldBlockGuestRoute } from "./guest-route-guard";

describe("shouldBlockGuestRoute", () => {
  describe("for guest role", () => {
    it("blocks /global exactly", () => {
      expect(shouldBlockGuestRoute("guest", "/actions")).toBe(true);
    });

    it("blocks /global/anything", () => {
      expect(shouldBlockGuestRoute("guest", "/actions/stats")).toBe(true);
    });

    it("blocks /settings exactly", () => {
      expect(shouldBlockGuestRoute("guest", "/parametres")).toBe(true);
    });

    it("blocks /parametres/equipe", () => {
      expect(shouldBlockGuestRoute("guest", "/parametres/equipe")).toBe(true);
    });

    it("blocks /parametres/organisations", () => {
      expect(shouldBlockGuestRoute("guest", "/parametres/organisations")).toBe(true);
    });

    it("blocks /parametres/categories", () => {
      expect(shouldBlockGuestRoute("guest", "/parametres/categories")).toBe(true);
    });

    it("does NOT block /users", () => {
      expect(shouldBlockGuestRoute("guest", "/techniciens")).toBe(false);
    });

    it("does NOT block /product", () => {
      expect(shouldBlockGuestRoute("guest", "/produits")).toBe(false);
    });

    it("does NOT block /stock", () => {
      expect(shouldBlockGuestRoute("guest", "/stock")).toBe(false);
    });

    it("does NOT block /orders", () => {
      expect(shouldBlockGuestRoute("guest", "/mouvements")).toBe(false);
    });

    it("does NOT block a URL that merely contains /global as substring", () => {
      expect(shouldBlockGuestRoute("guest", "/actionsization")).toBe(false);
    });
  });

  describe("for non-guest roles", () => {
    it.each(["owner", "admin", "member"])(
      "never blocks %s on any path",
      (role) => {
        expect(shouldBlockGuestRoute(role, "/actions")).toBe(false);
        expect(shouldBlockGuestRoute(role, "/parametres")).toBe(false);
        expect(shouldBlockGuestRoute(role, "/parametres/equipe")).toBe(false);
        expect(shouldBlockGuestRoute(role, "/techniciens")).toBe(false);
      }
    );
  });

  describe("for undefined role", () => {
    it("does not block (user not yet loaded)", () => {
      expect(shouldBlockGuestRoute(undefined, "/actions")).toBe(false);
      expect(shouldBlockGuestRoute(undefined, "/parametres")).toBe(false);
    });
  });
});
