import { describe, it, expect } from "vitest";
import { formatBytes } from "./use-file-upload";

describe("formatBytes", () => {
  it("returns '0 Bytes' for 0", () => {
    expect(formatBytes(0)).toBe("0 Bytes");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1024)).toBe("1KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1024 * 1024)).toBe("1MB");
  });

  // BUG: Negative bytes produce NaN because Math.log of a negative is NaN
  // sizes[NaN] is undefined, so NaN + undefined = NaN (number, not string)
  it("returns NaN for negative bytes (known bug)", () => {
    const result = formatBytes(-100);
    expect(Number.isNaN(result as unknown as number)).toBe(true);
  });

  it("respects decimal parameter", () => {
    expect(formatBytes(1536, 1)).toBe("1.5KB");
  });
});
