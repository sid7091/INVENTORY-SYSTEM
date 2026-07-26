"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, checkPermission, PERMISSION_DENIED_MSG } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { savePhoto, stagePhoto, commitStaged, deleteStaged } from "@/lib/storage";
import { parsePhotoName } from "@/lib/utils";
import { buildBlockMatcher } from "@/lib/blockMatch";
import { attachPhoto } from "@/lib/photoAttach";
import type { ActionResult } from "./blocks";

// Add one or more photos to a single block (used from the block detail page).
export async function addBlockPhotos(blockId: string, formData: FormData): Promise<ActionResult> {
  const user = await checkPermission("photos.add");
  if (!user) return { ok: false, error: PERMISSION_DENIED_MSG };
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
  revalidatePath("/needs-actions");
  return { ok: true, id: blockId };
}

export async function deletePhoto(photoId: string): Promise<ActionResult> {
  const user = await checkPermission("photos.add");
  if (!user) return { ok: false, error: PERMISSION_DENIED_MSG };
  const photo = await prisma.photo.findUnique({ where: { id: photoId } });
  if (!photo) return { ok: false, error: "Photo not found." };
  await prisma.$transaction(async (tx) => {
    await tx.photo.delete({ where: { id: photoId } });
    const remaining = await tx.photo.findMany({ where: { blockId: photo.blockId }, orderBy: { createdAt: "asc" } });
    if (remaining.length === 0) {
      // Checkpoint: a block with zero photos must always sit back in the
      // photo gate, however it lost its last photo — this is the one
      // mutation that can take a block from "has a photo" to "has none".
      const block = await tx.block.findUnique({ where: { id: photo.blockId } });
      if (block && block.status !== "NEEDS_PHOTOS") {
        await tx.block.update({ where: { id: photo.blockId }, data: { status: "NEEDS_PHOTOS", version: { increment: 1 } } });
        await logAudit(tx, {
          action: "STATUS_CHANGE",
          userId: user.userId,
          blockId: photo.blockId,
          reason: "Returned to the photo gate: last photo removed",
          changes: { status: { from: block.status, to: "NEEDS_PHOTOS" } },
        });
      }
    } else if (photo.isPrimary) {
      // Deleting the primary photo must not leave the block with none —
      // promote the oldest remaining photo so the grid thumbnail doesn't vanish.
      await tx.photo.update({ where: { id: remaining[0].id }, data: { isPrimary: true } });
    }
    await logAudit(tx, { action: "PHOTO_DELETE", userId: user.userId, blockId: photo.blockId, reason: `Photo removed: ${photo.filename}` });
  });
  revalidatePath(`/inventory/${photo.blockId}`);
  revalidatePath("/inventory");
  revalidatePath("/needs-actions");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Bulk Photo Upload Room
// ---------------------------------------------------------------------------

// Stage dropped files into a review batch. Auto-matches filename -> block number.
export async function createPhotoBatch(formData: FormData): Promise<{ ok: true; batchId: string } | { ok: false; error: string }> {
  const user = await checkPermission("photoroom.use");
  if (!user) return { ok: false, error: PERMISSION_DENIED_MSG };
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, error: "No files selected." };

  const batch = await prisma.photoBatch.create({ data: { createdBy: user.userId, status: "REVIEW" } });
  const match = await buildBlockMatcher();

  for (const f of files) {
    const bytes = Buffer.from(await f.arrayBuffer());
    const { tempUrl } = await stagePhoto(f.name, bytes);
    const parsed = parsePhotoName(f.name);
    const matchedBlockId = parsed ? match({ key: parsed.key, digits: parsed.digits }) : null;
    await prisma.photoBatchItem.create({
      data: {
        batchId: batch.id,
        filename: f.name,
        tempUrl,
        guessBlockNo: parsed?.raw ?? null,
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
  if (!(await checkPermission("photoroom.use"))) return { ok: false, error: PERMISSION_DENIED_MSG };
  const item = await prisma.photoBatchItem.findUnique({ where: { id: itemId } });
  if (!item) return { ok: false, error: "Item not found." };

  let matchedBlockId = item.matchedBlockId;
  if (decision === "REASSIGN" || decision === "APPROVE") {
    if (reassignBlockNo) {
      // Exact block number first; otherwise fall back to the same fuzzy matcher
      // used for auto-matching (so "543" or "M543" resolves too).
      const exact = await prisma.block.findFirst({
        where: { blockNo: reassignBlockNo.toUpperCase(), deletedAt: null },
        select: { id: true },
      });
      if (exact) {
        matchedBlockId = exact.id;
      } else {
        const parsed = parsePhotoName(`${reassignBlockNo}.x`);
        const match = await buildBlockMatcher();
        const id = parsed ? match({ key: parsed.key, digits: parsed.digits }) : null;
        if (!id) return { ok: false, error: `No unique block found for "${reassignBlockNo}".` };
        matchedBlockId = id;
      }
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
  const user = await checkPermission("photoroom.use");
  if (!user) return { ok: false, error: PERMISSION_DENIED_MSG };
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
  revalidatePath("/needs-actions");
  return { ok: true, committed: committedFiles.length, promoted };
}

export async function discardPhotoBatch(batchId: string): Promise<ActionResult> {
  if (!(await checkPermission("photoroom.use"))) return { ok: false, error: PERMISSION_DENIED_MSG };
  const batch = await prisma.photoBatch.findUnique({ where: { id: batchId }, include: { items: true } });
  if (!batch) return { ok: false, error: "Batch not found." };
  for (const item of batch.items) await deleteStaged(item.tempUrl);
  await prisma.photoBatch.update({ where: { id: batchId }, data: { status: "DISCARDED" } });
  revalidatePath("/photo-room");
  return { ok: true };
}
