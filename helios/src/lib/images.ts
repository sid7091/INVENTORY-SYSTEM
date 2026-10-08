// Browser-only image helpers: convert/compress before upload, crop to a box
// for the PDF, and load images for canvas work.

export class UnreadablePhotoError extends Error {}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Couldn't load ${src}`));
    img.src = src;
  });
}

async function decodeFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await loadImage(url);
  } catch {
    throw new UnreadablePhotoError(
      "This photo couldn't be read. On iPhone set Settings → Camera → Formats → Most Compatible.",
    );
  } finally {
    // Safe: the decoded image keeps its pixels after the URL is revoked.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't encode the image."))), "image/jpeg", quality),
  );
}

function drawScaled(img: HTMLImageElement, longest: number) {
  const scale = Math.min(1, longest / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

export interface PreparedPhoto {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

/** Any phone photo (including HEIC where the browser can decode it) → JPEG, longest side 2400px, plus a thumbnail. */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const img = await decodeFile(file);
  const big = drawScaled(img, 2400);
  const small = drawScaled(img, 640);
  const [full, thumb] = await Promise.all([canvasToBlob(big, 0.86), canvasToBlob(small, 0.8)]);
  return { full, thumb, width: big.width, height: big.height };
}

/** Crops (cover, centred) to the box ratio and returns a JPEG data URL. */
export function cropToBox(
  img: HTMLImageElement,
  boxW: number,
  boxH: number,
  opts: { scale: number; maxPx: number; jpeg: number },
): string {
  const outW = Math.round(Math.min(boxW * opts.scale, opts.maxPx));
  const outH = Math.round((outW * boxH) / boxW);
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  const s = Math.max(outW / img.naturalWidth, outH / img.naturalHeight);
  const w = img.naturalWidth * s;
  const h = img.naturalHeight * s;
  ctx.drawImage(img, (outW - w) / 2, (outH - h) / 2, w, h);
  return canvas.toDataURL("image/jpeg", opts.jpeg);
}
