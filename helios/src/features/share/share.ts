// Sending photos out of the app: the phone share sheet (WhatsApp etc.) when
// it can take files, otherwise a download. The caption is always copied too,
// because WhatsApp sometimes drops shared text.

export const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export function canShareFiles(files: File[]): boolean {
  try {
    return typeof navigator !== "undefined" && !!navigator.canShare && navigator.canShare({ files });
  } catch {
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export type ShareOutcome = "shared" | "cancelled" | "downloaded";

/** Must be called straight from a tap, with the files already prepared. */
export async function shareFiles(files: File[], caption: string): Promise<ShareOutcome> {
  void copyText(caption);
  if (canShareFiles(files)) {
    try {
      await navigator.share({ files, text: caption });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      // Some browsers refuse text alongside files — try files alone.
      try {
        await navigator.share({ files });
        return "shared";
      } catch (e2) {
        if (e2 instanceof DOMException && e2.name === "AbortError") return "cancelled";
      }
    }
  }
  files.forEach((f, i) => setTimeout(() => downloadBlob(f, f.name), i * 400));
  return "downloaded";
}
