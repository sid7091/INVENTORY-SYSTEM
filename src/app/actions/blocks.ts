"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit, diff } from "@/lib/audit";
import { blockSchema, statusChangeSchema } from "@/lib/validation";

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
    revalidatePath("/needs-photos");
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
  const { status, reason } = parsed.data;

  const existing = await prisma.block.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) return { ok: false, error: "Block not found." };
  if (existing.status === "NEEDS_PHOTOS") {
    return { ok: false, error: "This block is still in the photo gate. Add a photo before setting a status." };
  }
  if (existing.version !== expectedVersion) {
    return { ok: false, stale: true, error: `Block changed since you opened it (now v${existing.version}). Reload before changing status.` };
  }
  if (existing.status === status) return { ok: false, error: `Block is already ${status}.` };

  try {
    await prisma.$transaction(async (tx) => {
      const res = await tx.block.updateMany({
        where: { id, version: expectedVersion },
        data: { status, version: { increment: 1 } },
      });
      if (res.count === 0) throw new Error("STALE");
      await logAudit(tx, {
        action: "STATUS_CHANGE",
        userId: user.userId,
        blockId: id,
        reason,
        changes: { status: { from: existing.status, to: status } },
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
