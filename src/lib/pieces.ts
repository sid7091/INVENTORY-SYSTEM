// Piece-range math for block-level slab tracking.
//
// A block with N slabs has pieces numbered 1..N. Portions can be SOLD or HOLD
// as ranges (e.g. 20–30). "Available" is the complement of everything allocated,
// so selling 20–30 out of 46 leaves available = 1–19, 31–46.

export type Range = [number, number];

// Parse a user string like "20-30, 35, 5-9" into ranges. Single numbers become
// a 1-length range. Whitespace and various dashes are tolerated.
export function parseRanges(input: string): Range[] {
  if (!input) return [];
  const out: Range[] = [];
  for (const part of input.split(/[,;]+/)) {
    const s = part.trim().replace(/\s*[–—]\s*/g, "-");
    if (!s) continue;
    const m = s.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!m) throw new Error(`Could not read "${part.trim()}" — use numbers or ranges like 20-30.`);
    const a = parseInt(m[1], 10);
    const b = m[2] != null ? parseInt(m[2], 10) : a;
    out.push(a <= b ? [a, b] : [b, a]);
  }
  return out;
}

// Merge overlapping/adjacent ranges into a sorted, minimal set.
export function normalizeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((x, y) => x[0] - y[0]);
  const merged: Range[] = [];
  for (const [a, b] of sorted) {
    const last = merged[merged.length - 1];
    if (last && a <= last[1] + 1) {
      last[1] = Math.max(last[1], b);
    } else {
      merged.push([a, b]);
    }
  }
  return merged;
}

// Complement of `blocks` within [1..n].
export function availableRanges(n: number, blocks: Range[]): Range[] {
  const taken = normalizeRanges(blocks);
  const out: Range[] = [];
  let cursor = 1;
  for (const [a, b] of taken) {
    if (a > cursor) out.push([cursor, a - 1]);
    cursor = Math.max(cursor, b + 1);
  }
  if (cursor <= n) out.push([cursor, n]);
  return out;
}

export function countPieces(ranges: Range[]): number {
  return normalizeRanges(ranges).reduce((sum, [a, b]) => sum + (b - a + 1), 0);
}

// True if any piece appears in both sets.
export function rangesOverlap(a: Range[], b: Range[]): boolean {
  const na = normalizeRanges(a);
  for (const [x0, x1] of na) {
    for (const [y0, y1] of b) {
      if (x0 <= y1 && y0 <= x1) return true;
    }
  }
  return false;
}

// Are all listed ranges within [1..n]?
export function rangesWithin(n: number, ranges: Range[]): boolean {
  return ranges.every(([a, b]) => a >= 1 && b <= n);
}

export function formatRanges(ranges: Range[]): string {
  const norm = normalizeRanges(ranges);
  if (norm.length === 0) return "—";
  return norm.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(", ");
}

export interface AllocationLike {
  fromPiece: number;
  toPiece: number;
  kind: string; // SOLD | HOLD
}

export interface PieceSummary {
  total: number;
  soldRanges: Range[];
  heldRanges: Range[];
  availableRanges: Range[];
  soldCount: number;
  heldCount: number;
  availableCount: number;
}

// Roll a block's piece count + allocations up into sold/held/available ranges.
export function summarize(total: number, allocs: AllocationLike[]): PieceSummary {
  const sold = allocs.filter((a) => a.kind === "SOLD").map((a): Range => [a.fromPiece, a.toPiece]);
  const held = allocs.filter((a) => a.kind === "HOLD").map((a): Range => [a.fromPiece, a.toPiece]);
  const soldRanges = normalizeRanges(sold);
  const heldRanges = normalizeRanges(held);
  const available = availableRanges(total, [...sold, ...held]);
  return {
    total,
    soldRanges,
    heldRanges,
    availableRanges: available,
    soldCount: countPieces(soldRanges),
    heldCount: countPieces(heldRanges),
    availableCount: countPieces(available),
  };
}
