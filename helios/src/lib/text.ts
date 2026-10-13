// Small text helpers shared by browser and server.

export function clean(v: string | null | undefined): string | null {
  const t = (v ?? "").replace(/\s+/g, " ").trim();
  return t ? t : null;
}

export function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s\-\/(])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
}

/** Removes characters that phones and Windows refuse in file names. */
export function safeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
}
