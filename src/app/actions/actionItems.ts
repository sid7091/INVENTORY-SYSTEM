"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { checkPermission, PERMISSION_DENIED_MSG } from "@/lib/auth";
import type { SessionPayload } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { importDriveFolderPhotos } from "@/lib/driveSync";
import { buildBlockMatcher } from "@/lib/blockMatch";
import { parsePhotoName } from "@/lib/utils";
import type { ActionResult } from "./blocks";

// Core of resolving one item — shared by the single-item and bulk entry
// points below. Does its own commit but no revalidation (callers do that
// once, after all items in a batch are done).
async function resolveOne(itemId: string, blockNoInput: string, user: SessionPayload): Promise<ActionResult> {
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

  return { ok: true, id: block.id };
}

// Staff confirms which block a Drive folder belongs to. Imports any photos
// from that folder into the chosen block right away, rather than waiting
// for the next scheduled sync.
export async function resolveActionItem(itemId: string, blockNoInput: string): Promise<ActionResult> {
  const user = await checkPermission("needsactions.resolve");
  if (!user) return { ok: false, error: PERMISSION_DENIED_MSG };
  const res = await resolveOne(itemId, blockNoInput, user);
  revalidatePath("/needs-actions");
  if (res.ok && res.id) {
    revalidatePath(`/inventory/${res.id}`);
    revalidatePath("/inventory");
  }
  return res;
}

// Batch version — resolves several items in one round trip (each with its
// own typed block number), for reviewing a long Needs Actions list quickly.
export async function resolveActionItemsBulk(
  items: { itemId: string; blockNo: string }[],
): Promise<{ ok: true; resolved: number; failed: { itemId: string; error: string }[] }> {
  const user = await checkPermission("needsactions.resolve");
  if (!user) return { ok: true, resolved: 0, failed: items.map((i) => ({ itemId: i.itemId, error: PERMISSION_DENIED_MSG })) };
  const failed: { itemId: string; error: string }[] = [];
  let resolved = 0;

  for (const { itemId, blockNo } of items) {
    const res = await resolveOne(itemId, blockNo, user);
    if (res.ok) resolved++;
    else failed.push({ itemId, error: res.error });
  }

  revalidatePath("/needs-actions");
  revalidatePath("/inventory");
  return { ok: true, resolved, failed };
}

// Dismiss an action item with no photo import (e.g. the folder is not
// actually one of our blocks).
export async function dismissActionItem(itemId: string): Promise<ActionResult> {
  const user = await checkPermission("needsactions.resolve");
  if (!user) return { ok: false, error: PERMISSION_DENIED_MSG };
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

// Batch dismiss — same idea as resolveActionItemsBulk but for "not one of
// our blocks, drop it" decisions made across several items at once.
export async function dismissActionItemsBulk(itemIds: string[]): Promise<{ ok: true; dismissed: number }> {
  const user = await checkPermission("needsactions.resolve");
  if (!user) return { ok: true, dismissed: 0 };
  const res = await prisma.actionItem.updateMany({
    where: { id: { in: itemIds }, status: "OPEN" },
    data: { status: "DISMISSED", resolvedBy: user.name, resolvedAt: new Date() },
  });
  revalidatePath("/needs-actions");
  return { ok: true, dismissed: res.count };
}
