"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { savePhoto, stagePhoto, commitStaged, deleteStaged } from "@/lib/storage";
import { parseBlockNoFromFilename } from "@/lib/utils";
import type { ActionResult } from "./blocks";

// Attach a photo to a block. The FIRST photo auto-promotes the block out of the
// NEEDS_PHOTOS gate into IN_STOCK (the "photo gate" rule).
async function attachPhoto(
  tx: import("@prisma/client").Prisma.TransactionClient,
  blockId: string,
  userId: string,
  file: { url: string; filename: string },
): Promise<{ promoted: boolean }> {
  const block = await tx.block.findUnique({ where: { id: blockId }, include: { _count: { select: { photos: true } } } });
  if (!block) throw new Error("Block not found");
  const isFirst = block._count.photos === 0;
  await tx.photo.create({
    data: { blockId, url: file.url, filename: file.filename, isPrimary: isFirst },
  });
  let promoted = false;
  if (block.status === "NEEDS_PHOTOS") {
    await tx.block.update({ where: { id: blockId }, data: { status: "IN_STOCK", version: { increment: 1 } } });
    await logAudit(tx, {
      action: "STATUS_CHANGE",
      userId,
      blockId,
      reason: "Auto-promoted: first photo attached (photo gate cleared)",
      changes: { status: { from: "NEEDS_PHOTOS", to: "IN_STOCK" } },
    });
    promoted = true;
  }
  await logAudit(tx, { action: "PHOTO_ADD", userId, blockId, reason: `Photo added: ${file.filename}` });
  return { promoted };
}

// Add one or more photos to a single block (used from the block detail page).
export async function addBlockPhotos(blockId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, error: "No files selected." };

  const saved = [] as { url: string; filename: string }[];
  for (const f of files) {
    const bytes = Buffer.from(await f.arrayBuffer());
    saved.push(await savePhoto(f.name, bytes));
  }

  await prisma.$transaction(async (tx) => {
    for (const s of saved) await attachPhoto(tx, blockId, user.userId, s);
  });

  revalidatePath(`/inventory/${blockId}`);
  revalidatePath("/inventory");
  revalidatePath("/needs-photos");
  return { ok: true, id: blockId };
}

export async function deletePhoto(photoId: string): Promise<ActionResult> {
  const user = await requireUser();
  const photo = await prisma.photo.findUnique({ where: { id: photoId } });
  if (!photo) return { ok: false, error: "Photo not found." };
  await prisma.$transaction(async (tx) => {
    await tx.photo.delete({ where: { id: photoId } });
    await logAudit(tx, { action: "PHOTO_DELETE", userId: user.userId, blockId: photo.blockId, reason: `Photo removed: ${photo.filename}` });
  });
  revalidatePath(`/inventory/${photo.blockId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Bulk Photo Upload Room
// ---------------------------------------------------------------------------

// Stage dropped files into a review batch. Auto-matches filename -> block number.
export async function createPhotoBatch(formData: FormData): Promise<{ ok: true; batchId: string } | { ok: false; error: string }> {
  const user = await requireUser();
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, error: "No files selected." };

  const batch = await prisma.photoBatch.create({ data: { createdBy: user.userId, status: "REVIEW" } });

  for (const f of files) {
    const bytes = Buffer.from(await f.arrayBuffer());
    const { tempUrl } = await stagePhoto(f.name, bytes);
    const guess = parseBlockNoFromFilename(f.name);
    let matchedBlockId: string | null = null;
    if (guess) {
      const block = await prisma.block.findFirst({ where: { blockNo: guess, deletedAt: null }, select: { id: true } });
      matchedBlockId = block?.id ?? null;
    }
    await prisma.photoBatchItem.create({
      data: {
        batchId: batch.id,
        filename: f.name,
        tempUrl,
        guessBlockNo: guess,
        matchedBlockId,
        decision: matchedBlockId ? "APPROVE" : "PENDING", // pre-approve confident matches
      },
    });
  }

  revalidatePath("/photo-room");
  return { ok: true, batchId: batch.id };
}

// Update a single item's decision / reassignment during review.
export async function updatePhotoItem(
  itemId: string,
  decision: "APPROVE" | "SKIP" | "REJECT" | "REASSIGN" | "PENDING",
  reassignBlockNo?: string,
): Promise<ActionResult> {
  await requireUser();
  const item = await prisma.photoBatchItem.findUnique({ where: { id: itemId } });
  if (!item) return { ok: false, error: "Item not found." };

  let matchedBlockId = item.matchedBlockId;
  if (decision === "REASSIGN" || decision === "APPROVE") {
    if (reassignBlockNo) {
      const block = await prisma.block.findFirst({ where: { blockNo: reassignBlockNo.toUpperCase(), deletedAt: null }, select: { id: true } });
      if (!block) return { ok: false, error: `No block found with number ${reassignBlockNo}.` };
      matchedBlockId = block.id;
    }
    if (!matchedBlockId) return { ok: false, error: "Assign a valid block before approving." };
  }

  await prisma.photoBatchItem.update({
    where: { id: itemId },
    data: { decision: decision === "REASSIGN" ? "APPROVE" : decision, matchedBlockId },
  });
  revalidatePath("/photo-room");
  return { ok: true };
}

// Commit the batch: only APPROVE items become real photos. Skipped/rejected are
// discarded. Runs in one transaction — nothing commits until approved.
export async function commitPhotoBatch(batchId: string): Promise<{ ok: true; committed: number; promoted: number } | { ok: false; error: string }> {
  const user = await requireUser();
  const batch = await prisma.photoBatch.findUnique({ where: { id: batchId }, include: { items: true } });
  if (!batch) return { ok: false, error: "Batch not found." };
  if (batch.status !== "REVIEW") return { ok: false, error: "This batch has already been processed." };

  const approved = batch.items.filter((i) => i.decision === "APPROVE" && i.matchedBlockId);
  if (approved.length === 0) return { ok: false, error: "Nothing approved to commit." };

  // Move staged files into permanent storage first (outside the DB tx).
  const committedFiles: { itemId: string; blockId: string; url: string; filename: string }[] = [];
  for (const item of approved) {
    const url = await commitStaged(item.tempUrl);
    committedFiles.push({ itemId: item.id, blockId: item.matchedBlockId!, url, filename: item.filename });
  }

  let promoted = 0;
  await prisma.$transaction(async (tx) => {
    for (const cf of committedFiles) {
      const res = await attachPhoto(tx, cf.blockId, user.userId, { url: cf.url, filename: cf.filename });
      if (res.promoted) promoted++;
    }
    await tx.photoBatch.update({ where: { id: batchId }, data: { status: "COMMITTED" } });
  });

  // Clean up leftover staged files for non-approved items.
  for (const item of batch.items) {
    if (!approved.find((a) => a.id === item.id)) await deleteStaged(item.tempUrl);
  }

  revalidatePath("/photo-room");
  revalidatePath("/inventory");
  revalidatePath("/needs-photos");
  return { ok: true, committed: committedFiles.length, promoted };
}

export async function discardPhotoBatch(batchId: string): Promise<ActionResult> {
  await requireUser();
  const batch = await prisma.photoBatch.findUnique({ where: { id: batchId }, include: { items: true } });
  if (!batch) return { ok: false, error: "Batch not found." };
  for (const item of batch.items) await deleteStaged(item.tempUrl);
  await prisma.photoBatch.update({ where: { id: batchId }, data: { status: "DISCARDED" } });
  revalidatePath("/photo-room");
  return { ok: true };
}
