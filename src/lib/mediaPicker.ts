import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

/**
 * Cross-platform media picker.
 * On native (Capacitor): uses @capacitor/camera with an action sheet (Camera / Gallery).
 * On web: falls back to a hidden file input (camera intent on mobile browsers).
 *
 * Returns a File ready to upload, or null if user cancelled / denied permission.
 */
export type PickSource = "camera" | "gallery" | "ask";

export async function pickMedia(opts: { source?: PickSource; video?: boolean } = {}): Promise<File | null> {
  const { source = "ask", video = false } = opts;

  // Native flow
  if (Capacitor.isNativePlatform()) {
    try {
      let chosen: PickSource = source;
      if (source === "ask") {
        const { ActionSheet, ActionSheetButtonStyle } = await import("@capacitor/action-sheet");
        const res = await ActionSheet.showActions({
          title: video ? "Add video" : "Add photo",
          options: [
            { title: video ? "Record video" : "Take photo" },
            { title: "Choose from gallery" },
            { title: "Cancel", style: ActionSheetButtonStyle.Cancel },
          ],
        });
        if (res.index === 0) chosen = "camera";
        else if (res.index === 1) chosen = "gallery";
        else return null;
      }

      const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");

      // Permission check (camera path only — gallery uses photos permission auto-handled by plugin)
      if (chosen === "camera") {
        const perm = await Camera.checkPermissions();
        if (perm.camera !== "granted") {
          const req = await Camera.requestPermissions({ permissions: ["camera"] });
          if (req.camera !== "granted") {
            toast.error("Camera access is off. Enable it in your phone settings to take photos.");
            return null;
          }
        }
      }

      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: chosen === "camera" ? CameraSource.Camera : CameraSource.Photos,
        saveToGallery: false,
      });

      if (!photo.webPath) return null;
      const blob = await (await fetch(photo.webPath)).blob();
      const ext = photo.format || "jpg";
      return new File([blob], `capture-${Date.now()}.${ext}`, { type: blob.type || `image/${ext}` });
    } catch (e: any) {
      const msg = String(e?.message || e || "");
      if (/cancel/i.test(msg)) return null;
      if (/denied|permission/i.test(msg)) {
        toast.error("Permission denied. Enable camera/photos access in your phone settings.");
        return null;
      }
      toast.error(msg || "Could not open camera");
      return null;
    }
  }

  // Web fallback
  return new Promise<File | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = video ? "video/*" : "image/*";
    if (source === "camera") input.setAttribute("capture", "environment");
    input.onchange = () => {
      const f = input.files?.[0] ?? null;
      resolve(f);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
