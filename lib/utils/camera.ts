/**
 * Find the rear (environment) camera device ID.
 * On iPhone Safari, facingMode constraints can be unreliable —
 * enumerating devices and matching by label is more robust.
 *
 * Returns the deviceId string, or null if not found (fallback to facingMode).
 */
export async function getRearCameraId(): Promise<string | null> {
  try {
    // Need a brief getUserMedia call first so Safari grants device labels
    const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
    tempStream.getTracks().forEach((t) => t.stop());

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((d) => d.kind === "videoinput");

    // On iOS, the rear camera label typically contains "Back" or "arrière"
    const rear = videoDevices.find(
      (d) =>
        /back|arrière|rear|environment/i.test(d.label)
    );

    if (rear) return rear.deviceId;

    // If multiple cameras and no label match, pick the last one
    // (on most phones the rear camera is listed last)
    if (videoDevices.length > 1) {
      return videoDevices[videoDevices.length - 1].deviceId;
    }

    return null;
  } catch {
    return null;
  }
}
