import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatNumber(n: number | null | undefined, digits = 2): string {
  if (n == null) return "—";
  return n.toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

export function formatSft(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${formatNumber(n)} SFT`;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export interface ParsedPhotoName {
  raw: string; // the block-ish token as found, e.g. "ANW-M543", "M543", "543"
  key: string; // normalised alnum key for matching, e.g. "ANWM543", "M543", "543"
  digits: string | null; // the block's digit run, e.g. "543"
  slabNo: string | null; // trailing slab number/letter if present, e.g. "1", "A"
}

// Parse a block token (and optional slab number) out of an arbitrary photo
// filename. A slab suffix is only recognised when it is SEPARATED from the
// block number, so ten photos for one block all resolve to the same block:
//   "ANW-M543.jpg"      -> { key: "ANWM543", digits: "543", slabNo: null }
//   "ANW-M543 1.jpg"    -> { key: "ANWM543", digits: "543", slabNo: "1" }
//   "ANW-M543_2.jpg"    -> { key: "ANWM543", digits: "543", slabNo: "2" }
//   "ANWM543 (3).png"   -> { key: "ANWM543", digits: "543", slabNo: "3" }
//   "M543-4.jpg"        -> { key: "M543",    digits: "543", slabNo: "4" }  (prefix missing)
//   "543 5.jpg"         -> { key: "543",     digits: "543", slabNo: "5" }  (prefix missing)
export function parsePhotoName(filename: string): ParsedPhotoName | null {
  const base = filename.replace(/\.[^.]+$/, "").trim();
  if (!base) return null;
  const up = base.toUpperCase().replace(/[()[\]]/g, " ");
  // Block token: optional letter prefix, optional separator, optional single
  // letter, then the digit run. The digit run is greedy so an unseparated
  // number stays part of the block (e.g. M1467), while a separated trailing
  // number is left for the slab match below.
  const m = up.match(/([A-Z]{0,6})[-\s]?([A-Z])?(\d{2,6})/);
  if (!m) return null;
  const prefix = m[1] || "";
  const midLetter = m[2] || "";
  const digits = m[3];
  const raw = `${prefix}${prefix ? "-" : ""}${midLetter}${digits}`.replace(/^-/, "");
  const key = `${prefix}${midLetter}${digits}`;
  // Slab number: a separated 1–3 digit number or single letter right after the block token.
  const rest = up.slice(m.index! + m[0].length);
  const slabMatch = rest.match(/^[\s\-_]+([0-9]{1,3}|[A-Z])\b/);
  return { raw, key, digits, slabNo: slabMatch ? slabMatch[1] : null };
}

export function slugifyFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : "";
  const stem = (dot >= 0 ? name.slice(0, dot) : name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${stem || "photo"}${ext}`;
}
