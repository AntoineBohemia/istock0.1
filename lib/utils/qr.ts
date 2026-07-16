// QR code patterns for product identification
// - Legacy: smpr://product/{id}
// - Old URL: https://istock-app.space/stock?product={id}
// - New URL: https://istock-app.space/actions?product={id}
const LEGACY_PATTERN = /^smpr:\/\/product\/([a-zA-Z0-9-]+)$/;
const URL_PATTERN = /^https?:\/\/[^/]+\/(?:stock|actions)\?product=([a-zA-Z0-9-]+)/;

/**
 * Extract a product ID from a scanned QR code string.
 * Returns the product ID or null if the format is invalid.
 */
export function parseProductQr(decodedText: string): string | null {
  const match = decodedText.match(LEGACY_PATTERN) ?? decodedText.match(URL_PATTERN);
  return match ? match[1] : null;
}
