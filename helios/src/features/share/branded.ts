// Branded photo: the original photo with a navy band added underneath
// (the photo itself is never covered) showing name, size and block no.

import { brand } from "@/config/brand";
import { loadImage } from "@/lib/images";
import { safeFileName } from "@/lib/text";
import type { SlabFields } from "@/lib/types";

const FONT = "HeliosBand";
let fontsReady: Promise<boolean> | null = null;

function loadFonts(): Promise<boolean> {
  fontsReady ??= (async () => {
    try {
      const regular = new FontFace(FONT, `url(${brand.assets.fontRegular})`, { weight: "400" });
      const bold = new FontFace(FONT, `url(${brand.assets.fontBold})`, { weight: "700" });
      await Promise.all([regular.load(), bold.load()]);
      document.fonts.add(regular);
      document.fonts.add(bold);
      return true;
    } catch {
      return false; // falls back to the system sans-serif
    }
  })();
  return fontsReady;
}

let logoPromise: Promise<HTMLImageElement | null> | null = null;
const loadLogo = () => (logoPromise ??= loadImage(brand.assets.logoMain).catch(() => null));

function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: string, size: number, family: string, maxW: number) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > 8 && ctx.measureText(text).width > maxW) {
    s -= 1;
    ctx.font = `${weight} ${s}px ${family}`;
  }
}

export async function brandedPhoto(photoUrl: string, slab: SlabFields): Promise<Blob> {
  const [img, logo, hasFont] = await Promise.all([loadImage(photoUrl), loadLogo(), loadFonts()]);
  const family = hasFont ? `"${FONT}", sans-serif` : "sans-serif";

  const scale = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
  const W = Math.round(img.naturalWidth * scale);
  const H = Math.round(img.naturalHeight * scale);
  const band = Math.round(Math.max(W * 0.085, 90));
  const pad = band * 0.32;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H + band;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, W, H);
  ctx.fillStyle = brand.colors.navy;
  ctx.fillRect(0, H, W, band);

  let textRight = W - pad;
  if (logo) {
    const lh = band * 0.72;
    const lw = (logo.naturalWidth / logo.naturalHeight) * lh;
    ctx.drawImage(logo, W - pad - lw, H + (band - lh) / 2, lw, lh);
    textRight = W - pad - lw - pad;
  }
  const maxW = textRight - pad;

  const line1 = slab.name.toUpperCase();
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = brand.colors.white;
  fitFont(ctx, line1, "700", band * 0.34, family, maxW);
  ctx.fillText(line1, pad, H + band * 0.47);

  const line2 = [slab.size && `SIZE : ${slab.size}`, slab.block && `BLOCK NO : ${slab.block}`]
    .filter(Boolean)
    .join("     |     ")
    .toUpperCase();
  ctx.fillStyle = brand.colors.cream;
  fitFont(ctx, line2, "400", band * 0.2, family, maxW);
  ctx.fillText(line2, pad, H + band * 0.47 + band * 0.31);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't make the photo."))), "image/jpeg", 0.9),
  );
}

export function brandedFileName(slab: SlabFields, label: string | null, index: number): string {
  return safeFileName(`${slab.name} - ${slab.size} - Block ${slab.block} - ${label || index + 1}`) + ".jpg";
}
