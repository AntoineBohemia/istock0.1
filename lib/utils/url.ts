/**
 * Validates that a URL string is an internal path (starts with / and is not a protocol-relative URL).
 * Prevents open redirect vulnerabilities.
 */
export function isInternalPath(url: string): boolean {
  if (!url || !url.startsWith("/") || url.startsWith("//")) {
    return false;
  }
  try {
    const parsed = new URL(url, "http://localhost");
    return parsed.origin === "http://localhost";
  } catch {
    return false;
  }
}
