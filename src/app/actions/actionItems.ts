"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { importDriveFolderPhotos } from "@/lib/driveSync";
import { buildBlockMatcher } from "@/lib/blockMatch";
import { parsePhotoName } from "@/lib/utils";
import type { ActionResult } from "./blocks";

// Staff confirms which block a Drive folder belongs to. Imports any photos
// from that folder into the chosen block right away, rather than waiting
// for the next scheduled sync.
export async function resolveActionItem(itemId: string, blockNoInput: string): Promise<ActionResult> {
  const user = await requireUser();
  const item = await prisma.actionItem.findUnique({ where: { id: itemId } });
  if (!item) return { ok: false, error: "This item no longer exists." };
  if (item.status !== "OPEN") return { ok: false, error: "This item has already been handled." };

  const typed = blockNoInput.trim();
  if (!typed) return { ok: false, error: "Enter a block number." };

  const exact = await prisma.block.findFirst({
    where: { blockNo: typed.toUpperCase(), deletedAt: null },
    select: { id: true, blockNo: true },
  });
  let block = exact;
  if (!block) {
    const parsed = parsePhotoName(`${typed}.x`);
    const match = await buildBlockMatcher();
    const id = parsed ? match({ key: parsed.key, digits: parsed.digits }) : null;
    if (id) block = await prisma.block.findUnique({ where: { id }, select: { id: true, blockNo: true } });
  }
  if (!block) return { ok: false, error: `No block found matching "${typed}".` };

  let imported = 0;
  if (item.driveFolderId) {
    try {
      imported = await importDriveFolderPhotos(item.driveFolderId, block.id);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Failed to import photos from Drive." };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.actionItem.update({
      where: { id: itemId },
      data: { status: "RESOLVED", blockId: block!.id, resolvedBy: user.name, resolvedAt: new Date() },
    });
    await logAudit(tx, {
      action: "DRIVE_ACTION_RESOLVED",
      userId: user.userId,
      blockId: block!.id,
      reason: `Assigned Drive folder "${item.driveFolderName ?? ""}" to this block (${imported} photo(s) imported)`,
    });
  });

  revalidatePath("/needs-actions");
  revalidatePath(`/inventory/${block.id}`);
  revalidatePath("/inventory");
  return { ok: true, id: block.id };
}

// Dismiss an action item with no photo import (e.g. the folder is not
// actually one of our blocks).
export async function dismissActionItem(itemId: string): Promise<ActionResult> {
  const user = await requireUser();
  const item = await prisma.actionItem.findUnique({ where: { id: itemId } });
  if (!item) return { ok: false, error: "This item no longer exists." };
  if (item.status !== "OPEN") return { ok: false, error: "This item has already been handled." };

  await prisma.actionItem.update({
    where: { id: itemId },
    data: { status: "DISMISSED", resolvedBy: user.name, resolvedAt: new Date() },
  });
  revalidatePath("/needs-actions");
  return { ok: true };
}
