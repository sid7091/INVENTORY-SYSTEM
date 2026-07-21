// Central brand config so the app can be white-labelled without code changes.
// Override via env (NEXT_PUBLIC_* so the values are available in the browser too):
//   NEXT_PUBLIC_BRAND_NAME="Eagle Stone"
//   NEXT_PUBLIC_BRAND_SHORT="Eagle"
//   NEXT_PUBLIC_BRAND_TAGLINE="Block-level marble & stone inventory"
const name = process.env.NEXT_PUBLIC_BRAND_NAME?.trim() || "Eagle Stone";

export const BRAND = {
  /** Full company/product name, e.g. "Eagle Stone". */
  name,
  /** Short name used in tight spaces (sidebar header). */
  short: process.env.NEXT_PUBLIC_BRAND_SHORT?.trim() || name.split(/\s+/)[0],
  /** One-line tagline. */
  tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE?.trim() || "Block-level marble & stone inventory",
  /** Single-letter monogram, used as a fallback if no logo image is set. */
  monogram: (process.env.NEXT_PUBLIC_BRAND_SHORT?.trim() || name).charAt(0).toUpperCase(),
  /** Path to the square icon mark (transparent PNG) — sidebar, mobile header. */
  logoUrl: process.env.NEXT_PUBLIC_BRAND_LOGO_URL?.trim() || "/eagle-logo.png",
  /** Path to the full stacked wordmark (transparent PNG) — login page hero. */
  wordmarkUrl: process.env.NEXT_PUBLIC_BRAND_WORDMARK_URL?.trim() || "/eagle-stone-wordmark.png",
} as const;

/** Filesystem-safe slug of the brand name, e.g. "eagle-stone" (for export/backup filenames). */
export function brandSlug(): string {
  return BRAND.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "inventory";
}
