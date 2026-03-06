import { Html5Qrcode } from "html5-qrcode";

/**
 * Find the rear (environment) camera device ID using html5-qrcode's own API.
 * This is more reliable than raw getUserMedia on Safari iOS.
 *
 * Returns the deviceId string, or null if not found (fallback to facingMode).
 */
export async function getRearCameraId(): Promise<string | null> {
  try {
    const cameras = await Html5Qrcode.getCameras();
    if (cameras.length === 0) return null;

    // On iOS, the rear camera label contains "Back" (en) or "arrière" (fr)
    const rear = cameras.find((c) =>
      /back|arrière|rear|environment/i.test(c.label)
    );

    if (rear) return rear.id;

    // If multiple cameras but no label match, pick the last one
    // (on most phones the rear camera is listed after the front)
    if (cameras.length > 1) {
      return cameras[cameras.length - 1].id;
    }

    // Single camera — let facingMode handle it
    return null;
  } catch {
    return null;
  }
}
