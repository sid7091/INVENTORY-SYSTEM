import type { SlabSummary } from "./types";

// A slab matches when every typed word appears in its name, material, colour,
// size or block — or when the query with spaces/punctuation removed appears in
// those fields squashed together. So "hcs593", "HCS 593" and "29596" all find
// the slab with block "29596 / HCS 593".

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const squash = (s: string) => fold(s).replace(/[^a-z0-9]/g, "");

function haystack(s: SlabSummary) {
  return [s.name, s.material, s.color, s.size, s.block].filter(Boolean).join(" | ");
}

export function matchesQuery(slab: SlabSummary, query: string): boolean {
  const q = fold(query).trim();
  if (!q) return true;
  const text = fold(haystack(slab));
  const words = q.split(/\s+/).filter(Boolean);
  if (words.every((w) => text.includes(w))) return true;
  const sq = squash(q);
  if (sq.length < 2) return false;
  // Per field, so a squashed query can't run across two fields by accident.
  return [slab.name, slab.material, slab.color, slab.size, slab.block].some((f) => f && squash(f).includes(sq));
}
