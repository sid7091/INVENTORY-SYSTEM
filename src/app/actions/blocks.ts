"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit, diff } from "@/lib/audit";
import { blockSchema, statusChangeSchema } from "@/lib/validation";
import { parseRanges, normalizeRanges, rangesOverlap, rangesWithin, summarize, formatRanges, type Range } from "@/lib/pieces";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; stale?: boolean; fieldErrors?: Record<string, string> };

function zodErrors(err: import("zod").ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) out[String(issue.path[0] ?? "form")] = issue.message;
  return out;
}

const EDITABLE_KEYS = [
  "blockNo", "quarryNo", "colour", "exporter", "quarry", "warehouse",
  "weightTons", "lengthCm", "heightCm", "pcs", "endPcs", "totalSft",
  "thicknessMm", "category",
];

export async function createBlock(raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = blockSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodErrors(parsed.error) };
  const data = parsed.data;

  const dupe = await prisma.block.findUnique({ where: { blockNo: data.blockNo.toUpperCase() } });
  if (dupe) return { ok: false, error: `Block ${data.blockNo} already exists.`, fieldErrors: { blockNo: "Already exists" } };

  try {
    const block = await prisma.$transaction(async (tx) => {
      // Every new block starts in the photo gate (NEEDS_PHOTOS) regardless of
      // category — it is only released once a photo is attached.
      const created = await tx.block.create({
        data: { ...data, blockNo: data.blockNo.toUpperCase(), status: "NEEDS_PHOTOS" },
      });
      await logAudit(tx, {
        action: "CREATE",
        userId: user.userId,
        blockId: created.id,
        reason: "Block created",
        changes: diff({}, created as unknown as Record<string, unknown>, EDITABLE_KEYS),
      });
      return created;
    });
    revalidatePath("/inventory");
    revalidatePath("/needs-actions");
    return { ok: true, id: block.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateBlock(id: string, expectedVersion: number, raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = blockSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodErrors(parsed.error) };
  const data = parsed.data;

  const existing = await prisma.block.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) return { ok: false, error: "Block not found." };

  // Optimistic concurrency: refuse if someone else edited since this form loaded.
  if (existing.version !== expectedVersion) {
    return {
      ok: false,
      stale: true,
      error: `This block was changed by someone else since you opened it (you had v${expectedVersion}, it is now v${existing.version}). Reload to see the latest values before saving.`,
    };
  }

  if (data.blockNo.toUpperCase() !== existing.blockNo) {
    const dupe = await prisma.block.findUnique({ where: { blockNo: data.blockNo.toUpperCase() } });
    if (dupe) return { ok: false, error: `Block ${data.blockNo} already exists.`, fieldErrors: { blockNo: "Already exists" } };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Guarded update: version must still match at write time.
      const res = await tx.block.updateMany({
        where: { id, version: expectedVersion },
        data: { ...data, blockNo: data.blockNo.toUpperCase(), version: { increment: 1 } },
      });
      if (res.count === 0) throw new Error("STALE");
      const after = await tx.block.findUnique({ where: { id } });
      const changes = diff(existing as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, EDITABLE_KEYS);
      await logAudit(tx, { action: "UPDATE", userId: user.userId, blockId: id, reason: "Block edited", changes });
    });
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${id}`);
    return { ok: true, id };
  } catch (e) {
    if ((e as Error).message === "STALE") {
      return { ok: false, stale: true, error: "This block was just changed by someone else. Reload and try again." };
    }
    return { ok: false, error: (e as Error).message };
  }
}

export async function changeStatus(id: string, expectedVersion: number, raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = statusChangeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "A reason is required.", fieldErrors: zodErrors(parsed.error) };
  const { status, reason, pieces } = parsed.data;

  const existing = await prisma.block.findUnique({
    where: { id },
    include: { allocations: true, _count: { select: { photos: true } } },
  });
  if (!existing || existing.deletedAt) return { ok: false, error: "Block not found." };
  // Checkpoint: gate on the ACTUAL photo count, not the stored status label —
  // this catches a block sitting on a live status with zero photos for any
  // reason (stale data, a future bug), not just the ones currently flagged
  // NEEDS_PHOTOS.
  if (existing._count.photos === 0) {
    return { ok: false, error: "This block has no photos yet. Add a photo before setting a status." };
  }
  if (existing.version !== expectedVersion) {
    return { ok: false, stale: true, error: `Block changed since you opened it (now v${existing.version}). Reload before changing status.` };
  }

  const total = existing.pcs ?? 0;
  const existingRanges: Range[] = existing.allocations.map((a): Range => [a.fromPiece, a.toPiece]);

  // Resolve the requested change into: allocations to create, whether to clear
  // existing ones, the final status, and an audit detail string.
  let createAllocs: { fromPiece: number; toPiece: number; kind: string }[] = [];
  let clearAllocs = false;
  let finalStatus: string = status;
  let detail = "";

  const needsPieces = status === "PARTIALLY_SOLD" || status === "HOLD";

  if (status === "IN_STOCK" || status === "READY_TO_DISPATCH") {
    // Returning to stock frees every piece.
    clearAllocs = existing.allocations.length > 0;
    detail = clearAllocs ? "released all sold/hold allocations" : "";
  } else if (status === "SOLD") {
    // Whole block sold: mark every piece sold.
    clearAllocs = true;
    if (total > 0) createAllocs = [{ fromPiece: 1, toPiece: total, kind: "SOLD" }];
    detail = total > 0 ? `all ${total} pieces sold` : "";
  } else if (needsPieces) {
    const kind = status === "PARTIALLY_SOLD" ? "SOLD" : "HOLD";
    if (total <= 0) {
      return { ok: false, error: "Set the block's number of slabs before recording partial sales or holds." };
    }
    if (pieces && pieces.trim()) {
      let ranges: Range[];
      try {
        ranges = parseRanges(pieces);
      } catch (e) {
        return { ok: false, error: (e as Error).message, fieldErrors: { pieces: (e as Error).message } };
      }
      if (!rangesWithin(total, ranges)) {
        return { ok: false, error: `Piece numbers must be between 1 and ${total}.`, fieldErrors: { pieces: `Out of range (1–${total})` } };
      }
      if (rangesOverlap(ranges, existingRanges)) {
        return { ok: false, error: "Some of those pieces are already sold or on hold. Free them first or pick other pieces.", fieldErrors: { pieces: "Overlaps existing allocation" } };
      }
      createAllocs = normalizeRanges(ranges).map(([a, b]) => ({ fromPiece: a, toPiece: b, kind }));
      detail = `${kind === "SOLD" ? "sold" : "held"} pieces ${formatRanges(ranges)}`;
    } else if (status === "HOLD") {
      // Hold with no pieces given = hold the whole remaining available block.
      const summ = summarize(total, existing.allocations);
      if (summ.availableRanges.length === 0) return { ok: false, error: "No available pieces left to hold." };
      createAllocs = summ.availableRanges.map(([a, b]) => ({ fromPiece: a, toPiece: b, kind: "HOLD" }));
      detail = `held all available pieces (${formatRanges(summ.availableRanges)})`;
    } else {
      return { ok: false, error: "Enter the piece numbers sold, e.g. 20-30.", fieldErrors: { pieces: "Required for a partial sale" } };
    }

    // Derive the real block status from the resulting allocation totals.
    const summ = summarize(total, [...existing.allocations, ...createAllocs]);
    if (summ.availableCount <= 0 && summ.heldCount === 0) finalStatus = "SOLD";
    else if (summ.availableCount <= 0 && summ.soldCount === 0) finalStatus = "HOLD";
    else if (summ.soldCount > 0) finalStatus = "PARTIALLY_SOLD";
    else finalStatus = "HOLD";
  }

  try {
    await prisma.$transaction(async (tx) => {
      const res = await tx.block.updateMany({
        where: { id, version: expectedVersion },
        data: { status: finalStatus, version: { increment: 1 } },
      });
      if (res.count === 0) throw new Error("STALE");
      if (clearAllocs) await tx.pieceAllocation.deleteMany({ where: { blockId: id } });
      for (const a of createAllocs) {
        await tx.pieceAllocation.create({
          data: { blockId: id, fromPiece: a.fromPiece, toPiece: a.toPiece, kind: a.kind, reason, createdBy: user.userId },
        });
      }
      await logAudit(tx, {
        action: "STATUS_CHANGE",
        userId: user.userId,
        blockId: id,
        reason: detail ? `${reason} — ${detail}` : reason,
        changes: { status: { from: existing.status, to: finalStatus } },
      });
    });
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${id}`);
    return { ok: true, id };
  } catch (e) {
    if ((e as Error).message === "STALE") return { ok: false, stale: true, error: "Block changed since you opened it. Reload and retry." };
    return { ok: false, error: (e as Error).message };
  }
}

export async function softDeleteBlock(id: string, reason: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!reason || reason.trim().length < 3) return { ok: false, error: "A reason is required to delete a block." };
  const existing = await prisma.block.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) return { ok: false, error: "Block not found." };
  await prisma.$transaction(async (tx) => {
    await tx.block.update({ where: { id }, data: { deletedAt: new Date(), version: { increment: 1 } } });
    await logAudit(tx, { action: "DELETE", userId: user.userId, blockId: id, reason });
  });
  revalidatePath("/inventory");
  revalidatePath("/trash");
  return { ok: true };
}

export async function restoreBlock(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const existing = await prisma.block.findUnique({ where: { id } });
  if (!existing || !existing.deletedAt) return { ok: false, error: "Block not found in trash." };
  await prisma.$transaction(async (tx) => {
    await tx.block.update({ where: { id }, data: { deletedAt: null, version: { increment: 1 } } });
    await logAudit(tx, { action: "RESTORE", userId: user.userId, blockId: id, reason: "Restored from trash" });
  });
  revalidatePath("/inventory");
  revalidatePath("/trash");
  return { ok: true };
}

export async function purgeBlock(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { ok: false, error: "Only admins can permanently delete blocks." };
  const existing = await prisma.block.findUnique({ where: { id } });
  if (!existing || !existing.deletedAt) return { ok: false, error: "Block not found in trash." };
  await prisma.block.delete({ where: { id } });
  revalidatePath("/trash");
  return { ok: true };
}
