import { prisma } from "@/lib/prisma";

// Normalised, matchable form of a block number: uppercase alphanumerics only.
export function normKey(blockNo: string): string {
  return blockNo.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
export function digitsOf(blockNo: string): string | null {
  const m = blockNo.match(/\d{2,6}/g);
  return m ? m[m.length - 1] : null;
}

type BlockKeyEntry = { id: string; blockNo: string; key: string; digits: string | null };

export type BlockMatcher = (token: { key: string; digits: string | null }) => string | null;

// Build a matcher over all live blocks. Resolves a parsed token (filename OR
// Drive folder name — both are "some descriptive text containing a block
// number") to a block id, but ONLY when the match is unambiguous:
//   1. exact normalised key   (ANW-M543  -> ANW-M543)
//   2. block key ends with token key, when the token has letters (M543 -> ANW-M543)
//   3. numeric equality, when the token is digits only (543 -> ANW-M543)
export async function buildBlockMatcher(): Promise<BlockMatcher> {
  const blocks = await prisma.block.findMany({
    where: { deletedAt: null },
    select: { id: true, blockNo: true },
  });
  const entries: BlockKeyEntry[] = blocks.map((b) => ({
    id: b.id,
    blockNo: b.blockNo,
    key: normKey(b.blockNo),
    digits: digitsOf(b.blockNo),
  }));

  return function match(token: { key: string; digits: string | null }): string | null {
    const k = token.key;
    let cands = entries.filter((e) => e.key === k);
    if (!cands.length && /[A-Z]/.test(k) && /\d/.test(k)) {
      cands = entries.filter((e) => e.key.endsWith(k));
    }
    if (!cands.length && token.digits) {
      cands = entries.filter((e) => e.digits === token.digits);
    }
    return cands.length === 1 ? cands[0].id : null; // unique match only
  };
}

// Same as buildBlockMatcher(), but also reports the candidate count so a
// caller can distinguish "no match" from "ambiguous — multiple candidates".
export async function buildBlockMatcherWithCandidates(): Promise<
  (token: { key: string; digits: string | null }) => { blockId: string | null; candidateCount: number }
> {
  const blocks = await prisma.block.findMany({
    where: { deletedAt: null },
    select: { id: true, blockNo: true },
  });
  const entries: BlockKeyEntry[] = blocks.map((b) => ({
    id: b.id,
    blockNo: b.blockNo,
    key: normKey(b.blockNo),
    digits: digitsOf(b.blockNo),
  }));

  return function match(token: { key: string; digits: string | null }) {
    const k = token.key;
    let cands = entries.filter((e) => e.key === k);
    if (!cands.length && /[A-Z]/.test(k) && /\d/.test(k)) {
      cands = entries.filter((e) => e.key.endsWith(k));
    }
    if (!cands.length && token.digits) {
      cands = entries.filter((e) => e.digits === token.digits);
    }
    return { blockId: cands.length === 1 ? cands[0].id : null, candidateCount: cands.length };
  };
}
