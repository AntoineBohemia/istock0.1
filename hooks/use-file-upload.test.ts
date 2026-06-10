import { describe, it, expect } from "vitest";
import { formatBytes } from "./use-file-upload";

describe("formatBytes", () => {
  it("returns '0 Bytes' for 0", () => {
    expect(formatBytes(0)).toBe("0 Bytes");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1024)).toBe("1 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1024 * 1024)).toBe("1 MB");
  });

  it("returns '0 Bytes' for negative bytes", () => {
    expect(formatBytes(-100)).toBe("0 Bytes");
  });

  it("respects decimal parameter", () => {
    expect(formatBytes(1536, 1)).toBe("1.5 KB");
  });
});
