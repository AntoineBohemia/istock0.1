import { describe, it, expect } from "vitest";
import { cn, generateAvatarFallback, getInitials } from "./utils";

// ─── cn ──────────────────────────────────────────────────────────────
describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("resolves Tailwind conflicts (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("returns empty string with no args", () => {
    expect(cn()).toBe("");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });
});

// ─── generateAvatarFallback ─────────────────────────────────────────
describe("generateAvatarFallback", () => {
  it("returns initials from two words", () => {
    expect(generateAvatarFallback("Jean Dupont")).toBe("JD");
  });

  it("returns single initial from one word", () => {
    expect(generateAvatarFallback("Jean")).toBe("J");
  });

  it("returns empty string from empty input", () => {
    expect(generateAvatarFallback("")).toBe("");
  });

  it("handles multiple spaces between words", () => {
    expect(generateAvatarFallback("  Jean   Dupont  ")).toBe("JD");
  });

  it("handles three words", () => {
    expect(generateAvatarFallback("Jean Claude Dupont")).toBe("JCD");
  });
});

// ─── getInitials ────────────────────────────────────────────────────
describe("getInitials", () => {
  it("returns initials from first and last name", () => {
    expect(getInitials("Jean Dupont")).toBe("JD");
  });

  it("handles lowercase names", () => {
    expect(getInitials("jean dupont")).toBe("JD");
  });

  // BUG: getInitials crashes when given a single word because
  // nameParts[1] is undefined and .charAt(0) throws on undefined.
  it("crashes on single word input (known bug)", () => {
    expect(() => getInitials("Jean")).toThrow();
  });
});
