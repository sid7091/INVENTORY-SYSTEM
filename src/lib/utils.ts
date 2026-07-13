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

// Parse a block number out of an arbitrary photo filename.
// Handles: "ANW-M543.jpg", "ANW-M543_1.jpg", "ANWM543 (2).png", "anw m543-a.jpeg"
export function parseBlockNoFromFilename(filename: string): string | null {
  const base = filename.replace(/\.[^.]+$/, ""); // strip extension
  // Normalise separators to help the regex.
  const cleaned = base.toUpperCase().replace(/[_\s]+/g, "-");
  // Match a prefix of letters, optional separator, a letter+digits core.
  const m = cleaned.match(/([A-Z]{2,5})[-]?([A-Z]?\d{2,6})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}`;
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
